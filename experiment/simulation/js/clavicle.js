/* ==============================
   CONFIGURATION
============================== */

const CM_PER_PIXEL = 1/27;

/* Separate, independently-calibratable scale factor for the
   girth tape only. Starts equal to CM_PER_PIXEL but can be
   recalibrated with calibrateGirthTape() without touching the
   caliper, board, or goniometer readings. */
let CM_PER_PIXEL_GIRTH = 1/9.5;

const TARGETS = {
    length: {
        val: 10.16, tol: 0.5, unit: "cm",
        instr: "Measure maximum length using osteometric board."
    },
    mid_dia: {
        val: 1.27, tol: 0.2, unit: "cm",
        instr: "Measure middle shaft diameter using sliding calipers."
    },
    mid_curve: {
        val: 155, tol: 5, unit: "deg",
        instr: "Measure middle curvature angle using goniometer."
    },
    lat_curve: {
        val: 165, tol: 5, unit: "deg",
        instr: "Measure lateral curvature angle using goniometer."
    },
    girth: {
        val: 4.00, tol: 0.2, unit: "cm",
        instr: "Wrap the tape around the narrowest point of the shaft and drag the tab until it sits snug, then read the girth."
    },
    indices: {
        val: 0, tol: 0, unit: "",
        instr: "Enter measured values to calculate clavicle indices."
    }
};

/* ==============================
   REAL CLAVICLE VALUES (HIDDEN)
============================== */

const REAL_CLAVICLE = {
    length: 10.16,
    mid_dia: 1.27,
    girth: 4.00
};

/* ==============================
   BONE POSES
============================== */

const BONE_POSES = {
    length:    { left: "70px", top: "160px", rotate: 0 },
    mid_dia:   { left: "160px", top: "160px", rotate: 90 },
    mid_curve: { left: "300px", top: "280px", rotate: 0 },
    lat_curve: { left: "340px", top: "280px", rotate: 10 },
    girth:     { left: "180px", top: "160px", rotate: 90 }
};

/* ==============================
   STATE
============================== */

let currentMode = "length";
let currentReading = 0;
let dragged = null;
let rotatingArm = null;
let offset = { x: 0, y: 0 };
let boneLocked = false;

/* ==============================
   MODE SWITCH
============================== */

function setMode(mode, event) {

    currentMode = mode;
    // Show/Hide controls
    const controls = document.getElementById("controls");

    if (mode === "length" ||  mode === "indices") {
        controls.style.display = "none";
    } else {
        controls.style.display = "block";
    }

    document.querySelectorAll(".nav-btn")
        .forEach(btn => btn.classList.remove("active"));

    if (event && event.target) {
        event.target.classList.add("active");
    }

    [
        "tool-board",
        "tool-caliper",
        "tool-goniometer",
        "tool-clavicle-indices",
        "tool-tape"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    document.getElementById("instruction").innerText =
        TARGETS[mode]?.instr || "";

    document.getElementById("unit").innerText =
        TARGETS[mode]?.unit || "";

    document.getElementById("readout").innerText = 0;
    document.getElementById("feedback").innerText = "";

    currentReading = 0;

    const bone = document.getElementById("bone");

    /* INDICES MODE */
    if (mode === "indices") {
        bone.style.display = "none";
        document.getElementById("tool-clavicle-indices").style.display = "block";
        return;
    } else {
        bone.style.display = "block";
        bone.style.cursor = boneLocked ? "default" : "grab";
    }

    /* Position bone */
    const pose = BONE_POSES[mode];
    if (pose) {
        bone.style.left = pose.left;
        bone.style.top = pose.top;
        bone.style.transform = `rotate(${pose.rotate}deg)`;
    }

    /* Show tools */
    if (mode === "length") {
        document.getElementById("tool-board").style.display = "block";
        document.getElementById("movable-wall").style.left = "420px";
    }
    else if (mode === "mid_dia") {

        document.getElementById("tool-caliper").style.display = "block";

        const slider =
            document.getElementById("caliper-slider");

        slider.style.left = "350px";
    }
    else if (mode === "mid_curve" || mode === "lat_curve") {
        document.getElementById("tool-goniometer").style.display = "block";
        const g = document.getElementById("goniometer");
        g.style.left = "350px";
        g.style.top = "250px";
    }
    else if (mode === "girth") {

        document.getElementById("tool-tape").style.display = "block";

        spawnTapeNearShaft();
    }
}

/* ==============================
   TOOL SPAWN
============================== */

/* Positions the tape's anchor pin, band, and end-tab near the
   shaft's mid-point (same mechanic as the Femur/Humerus labs) */
function spawnTapeNearShaft() {

    const anchor = document.getElementById("tape-anchor");
    const band   = document.getElementById("tape-band");
    const end    = document.getElementById("tape-end");

    /* anchor pin sits at the mid-shaft "wrap point" */
    const anchorX = 350;
    const anchorY = 250;
    const startWidth = 80; /* px, initial pulled-out length */

    anchor.style.left = anchorX + "px";
    anchor.style.top = anchorY + "px";

    band.style.left = (anchorX + 7) + "px";
    band.style.top = (anchorY - 6) + "px";
    band.style.width = startWidth + "px";

    end.style.left = (anchorX + 7 + startWidth) + "px";
    end.style.top = (anchorY - 11) + "px";

    currentReading = startWidth * CM_PER_PIXEL_GIRTH;
    document.getElementById("readout").innerText = currentReading.toFixed(2);
}

/* ==============================
   GIRTH TAPE CALIBRATION
============================== */

/* Reads the tape band's CURRENT pixel width and back-solves
   CM_PER_PIXEL_GIRTH so that width reports exactly `targetCm`
   right now (default 4 cm), without touching CM_PER_PIXEL or
   the caliper's readings.

   Usage:
     calibrateGirthTape();      // calibrates current width to 4 cm
     calibrateGirthTape(4.5);   // calibrates current width to 4.5 cm
*/
function calibrateGirthTape(targetCm = 4) {

    const band = document.getElementById("tape-band");
    const bandWidthPx = parseFloat(band.style.width);

    if (!bandWidthPx || bandWidthPx <= 0) {
        console.warn("calibrateGirthTape: no tape band width to calibrate from.");
        return;
    }

    CM_PER_PIXEL_GIRTH = targetCm / bandWidthPx;

    /* Refresh the live reading using the new scale */
    currentReading = bandWidthPx * CM_PER_PIXEL_GIRTH;

    const readout = document.getElementById("readout");
    if (readout) readout.innerText = currentReading.toFixed(2);

    console.log(
        `Girth tape calibrated: ${bandWidthPx}px = ${targetCm}cm ` +
        `(CM_PER_PIXEL_GIRTH = ${CM_PER_PIXEL_GIRTH.toFixed(5)})`
    );
}

/* ==============================
   INTERACTION
============================== */

document.addEventListener("mousedown", e => {

    if (
        (e.target.id === "bone" && !boneLocked) ||
        e.target.id === "movable-wall"
    ) {

        dragged = e.target;

        const rect = dragged.getBoundingClientRect();

        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }

    /* MOVE WHOLE CALIPER */
    else if (
        e.target.closest("#tool-caliper") &&
        !e.target.closest("#caliper-slider")
    ) {

        dragged = document.getElementById("tool-caliper");

        const rect = dragged.getBoundingClientRect();

        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }

    /* MOVE CALIPER SLIDER */
    else if (e.target.closest("#caliper-slider")) {

        dragged = document.getElementById("caliper-slider");

        const rect = dragged.getBoundingClientRect();

        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }

    if (e.target.closest("#goniometer") &&
        !e.target.classList.contains("gonio-arm")) {

        dragged = document.getElementById("goniometer");
        const rect = dragged.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }

    if (e.target.classList.contains("gonio-arm")) {
        rotatingArm = e.target;
    }

    /* GRAB TAPE END */
    if (e.target.closest("#tape-end")) {
        dragged = document.getElementById("tape-end");
        const rect = dragged.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }
});


document.addEventListener("mousemove", e => {

    if (dragged) {
        const workspace = document.getElementById("workspace").getBoundingClientRect();

        /* BOARD */
        if (currentMode === "length" && dragged.id === "movable-wall") {
            const ws = document.getElementById("workspace").getBoundingClientRect();
            let x = e.clientX - ws.left;
            x = Math.max(310, Math.min(x, 800));
            dragged.style.left = x + "px";
            currentReading = ((x - 310) * CM_PER_PIXEL);
        }

        /* MOVE BONE */
        else if (dragged.id === "bone") {

            const ws =
                document.getElementById("workspace")
                .getBoundingClientRect();

            let x =
                e.clientX - ws.left - offset.x;

            let y =
                e.clientY - ws.top - offset.y;

            dragged.style.left = x + "px";
            dragged.style.top  = y + "px";
        }

        /* MOVE WHOLE CALIPER */
        else if (dragged.id === "tool-caliper") {

            let x = e.clientX - workspace.left - offset.x;
            let y = e.clientY - workspace.top - offset.y;

            dragged.style.left = x + "px";
            dragged.style.top = y + "px";
        }

        else if (dragged.id === "caliper-slider") {

            const caliperBody =
                document.getElementById("caliper-body")
                .getBoundingClientRect();

            let x = e.clientX - caliperBody.left - offset.x;

            const minX = 60;
            const maxX = 520;

            if (x < minX) x = minX;
            if (x > maxX) x = maxX;

            dragged.style.left = x + "px";

            /* measurement calculation (caliper — unaffected by girth calibration) */
            const fixedJawX = 60;
            const distancePx = x - fixedJawX;

            currentReading = distancePx * CM_PER_PIXEL;
        }

        /* STRETCH TAPE END (measures girth) */
        else if (dragged.id === "tape-end" && currentMode === "girth") {

            const anchor = document.getElementById("tape-anchor");
            const anchorLeft = parseFloat(anchor.style.left);
            const anchorTop = parseFloat(anchor.style.top);

            let x = e.clientX - workspace.left - offset.x;

            /* keep a minimum pulled length so the band never inverts */
            const minX = anchorLeft + 7 + 20;
            if (x < minX) x = minX;

            dragged.style.left = x + "px";
            dragged.style.top = (anchorTop - 11) + "px";

            const band = document.getElementById("tape-band");
            const bandWidth = x - (anchorLeft + 7);
            band.style.width = bandWidth + "px";

            currentReading = bandWidth * CM_PER_PIXEL_GIRTH;

            const fb = document.getElementById("feedback");
            if (currentReading < 2) {
                fb.innerText = "⚠ Wrap the tape snugly around the shaft — it looks too loose.";
                fb.style.color = "orange";
            } else {
                fb.innerText = "";
            }
        }
    }

    /* GONIOMETER */
    if (rotatingArm) {
        const center = document.getElementById("gonio-center").getBoundingClientRect();
        const cx = center.left + center.width / 2;
        const cy = center.top + center.height / 2;

        const ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
        rotatingArm.style.transform = `rotate(${ang}deg)`;

        const a1 = getRotation(document.getElementById("gonio-arm-1"));
        const a2 = getRotation(document.getElementById("gonio-arm-2"));
        let diff = Math.abs(a1 - a2);
        if (diff > 180) diff = 360 - diff;
        currentReading = Math.round(diff);
    }

    /* MOVE GONIOMETER BODY */
    else if (
        (currentMode === "mid_curve" || currentMode === "lat_curve") &&
        dragged && dragged.id === "goniometer"
    ) {
        const ws = document.getElementById("workspace").getBoundingClientRect();

        let x = e.clientX - ws.left - offset.x;
        let y = e.clientY - ws.top - offset.y;

        dragged.style.left = x + "px";
        dragged.style.top  = y + "px";
    }

    document.getElementById("readout").innerText =
        parseFloat(currentReading).toFixed(2);
});

document.addEventListener("mouseup", () => {
    dragged = null;
    rotatingArm = null;
});

/* ==============================
   UTIL
============================== */

function getRotation(el) {
    if (!el.style.transform) return 0;
    return parseFloat(el.style.transform.replace("rotate(", "").replace("deg)", ""));
}

function createScale() {

    const scale =
        document.getElementById("scale");

    scale.innerHTML = "";

    const PX_PER_CM = 43;

    /* 40 cm scale with 0.1 cm divisions */
    for (let i = 0; i <= 150; i++) {

        const value = i / 10;

        const tick =
            document.createElement("div");

        tick.classList.add("tick");

        tick.style.left =
            (value * PX_PER_CM) + "px";

        /* Tick types */

        /* Every 1 cm */
        if (i % 10 === 0) {

            tick.classList.add("large");

            const label =
                document.createElement("div");

            label.classList.add("tick-label");

            label.style.left =
                (value * PX_PER_CM - 6) + "px";

            label.innerText = value.toFixed(0);

            scale.appendChild(label);
        }

        /* Every 0.5 cm */
        else if (i % 5 === 0) {

            tick.classList.add("medium");
        }

        /* Every 0.1 cm */
        else {

            tick.classList.add("small");
        }

        scale.appendChild(tick);
    }
}

/* ==============================
   CREATE CALIPER SCALE
============================== */

// function createCaliperScale() {

//     const scale = document.querySelector(".caliper-scale");

//     scale.innerHTML = "";

//     const PX_PER_CM = 20;

//     for (let i = 0; i <= 20; i++) {

//         const tick = document.createElement("div");

//         tick.classList.add("cal-tick");

//         tick.style.left = (i * PX_PER_CM) + "px";

//         if (i % 10 === 0) {
//             tick.classList.add("large");
//         }
//         else if (i % 5 === 0) {
//             tick.classList.add("medium");
//         }
//         else {
//             tick.classList.add("small");
//         }

//         scale.appendChild(tick);

//         /* labels every 1 cm */
//         const label = document.createElement("div");

//         label.classList.add("cal-label");

//         label.style.left = (i * PX_PER_CM - 4) + "px";

//         label.innerText = i;

//         scale.appendChild(label);
//     }
// }

/* ==============================
   GONIOMETER SCALE
============================== */

function createGonioScale() {

    const scale =
        document.getElementById("gonio-scale");

    scale.innerHTML = "";

    const radius = 78;

    for (let deg = 0; deg < 360; deg += 5) {

        const tick =
            document.createElement("div");

        tick.classList.add("gonio-tick");

        let tickLength = 6;

        if (deg % 10 === 0) {
            tickLength = 12;
        }

        const angle =
            (deg - 90) * Math.PI / 180;

        const x =
            90 + radius * Math.cos(angle);

        const y =
            90 + radius * Math.sin(angle);

        tick.style.left = x + "px";
        tick.style.top = y + "px";

        tick.style.height = tickLength + "px";

        tick.style.transform =
            `translate(-50%, -100%) rotate(${deg}deg)`;

        scale.appendChild(tick);

        /* labels */
        if (deg % 20 === 0) {

            const label =
                document.createElement("div");

            label.classList.add("gonio-label");

            label.innerText = deg;

            const lx =
                90 + (radius - 18) * Math.cos(angle);

            const ly =
                90 + (radius - 18) * Math.sin(angle);

            label.style.left = lx + "px";
            label.style.top = ly + "px";

            scale.appendChild(label);
        }
    }
}

/* ==============================
   CHECK
============================== */

function checkMeasurement() {
    const t = TARGETS[currentMode];
    const fb = document.getElementById("feedback");

    if (Math.abs(currentReading - t.val) <= t.tol) {
        fb.style.color = "green";
        fb.innerText = "✔ Correct measurement.";
    } else {
        fb.style.color = "red";
        fb.innerText = `✖ Incorrect. Accepted value ≈ ${t.val} ${t.unit}`;
    }
}

function checkIndices() {

    const userCaliber =
        parseFloat(document.getElementById("ans_caliber").value);

    const userRobust =
        parseFloat(document.getElementById("ans_robust").value);

    let score = 0;

    if (Math.abs(userCaliber - 12.50) <= 0.2)
        score++;

    if (Math.abs(userRobust - 39.37) <= 0.2)
        score++;

    const feedback = document.getElementById("IndexFeedback");

    if (score === 2) {

        feedback.style.color = "green";
        feedback.innerHTML =
            `✔ Excellent! All calculations are correct. (${score}/2)`;

    } else {

        feedback.style.color = "red";
        feedback.innerHTML =
            `✖ Some calculations are incorrect. Score: ${score}/2`;
    }
}

/* ==============================
   CORRECT CLAVICLE INDICES
============================== */

const CORRECT_CLAVICLE_INDICES = {

    ans_caliber: 12.50,
    ans_robust: 39.37

};

/* ==============================
   LIVE CALCULATION
============================== */

function calculateClavicle(numId, denId, ansId) {

    const num = parseFloat(document.getElementById(numId).value);
    const den = parseFloat(document.getElementById(denId).value);

    const ans = document.getElementById(ansId);

    if (isNaN(num) || isNaN(den) || den === 0) {

        ans.value = "";
        ans.style.background = "#fff8dc";
        ans.style.border = "2px solid #f1c40f";
        ans.style.color = "#000";

        return;
    }

    const result = (num * 100) / den;

    ans.value = result.toFixed(2);

    const correct = CORRECT_CLAVICLE_INDICES[ansId];

    if (Math.abs(result - correct) <= 0.2) {

        ans.style.background = "#d4edda";
        ans.style.border = "3px solid green";
        ans.style.color = "green";

    } else {

        ans.style.background = "#f8d7da";
        ans.style.border = "3px solid red";
        ans.style.color = "red";
    }
}

/* ==============================
   LIVE UPDATE
============================== */

document.addEventListener("input", () => {

    calculateClavicle(
        "caliber_num",
        "caliber_den",
        "ans_caliber"
    );

    calculateClavicle(
        "robust_num",
        "robust_den",
        "ans_robust"
    );

});

/* ==============================
   BONE LOCK / UNLOCK
============================== */

const bone = document.getElementById("bone");

/* Prevent browser drag ghost */
bone.ondragstart = () => false;

/* Double click to lock/unlock */
bone.addEventListener("dblclick", () => {

    boneLocked = !boneLocked;

    if (!boneLocked) {

        bone.style.cursor = "grab";

        bone.style.boxShadow =
            "0 8px 20px rgba(0,0,0,0.25)";

    }
    else {

        bone.style.cursor = "default";
        bone.style.boxShadow = "none";
    }
});

/* ==============================
   INIT
============================== */

setMode("length");
createScale();
createGonioScale();

/* Calibrate the girth tape so its CURRENT on-screen width
   reads exactly 4 cm, independent of the caliper's scale. */
calibrateGirthTape(4);