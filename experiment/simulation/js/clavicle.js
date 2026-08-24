/* ==============================
   CONFIGURATION
============================== */

const CM_PER_PIXEL = 1/20;

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
    lat_curve: { left: "340px", top: "280px", rotate: 10 }
};

/* ==============================
   STATE
============================== */

let currentMode = "length";
let currentReading = 0;
let dragged = null;
let rotatingArm = null;
let offset = { x: 0, y: 0 };

/* ==============================
   MODE SWITCH
============================== */

function setMode(mode, event) {

    currentMode = mode;

    document.querySelectorAll(".nav-btn")
        .forEach(btn => btn.classList.remove("active"));

    if (event && event.target) {
        event.target.classList.add("active");
    }

    [
        "tool-board",
        "tool-caliper",
        "tool-goniometer",
        "tool-clavicle-indices"
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
        document.getElementById("caliper-jaw-1").style.left = "330px";
        document.getElementById("caliper-jaw-2").style.left = "380px";
    }
    else {
        document.getElementById("tool-goniometer").style.display = "block";
        const g = document.getElementById("goniometer");
        g.style.left = "350px";
        g.style.top = "250px";
    }
}

/* ==============================
   INTERACTION
============================== */
document.addEventListener("mousedown", e => {

    /* BASIC TOOLS */
    if (
        e.target.id === "movable-wall" ||
        e.target.classList.contains("caliper-jaw")
    ) {
        dragged = e.target;

        const rect = dragged.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }

    /* MOVE WHOLE GONIOMETER */
    if (
        (currentMode === "mid_curve" || currentMode === "lat_curve") &&
        e.target.closest("#goniometer") &&
        !e.target.classList.contains("gonio-arm")
    ) {
        dragged = document.getElementById("goniometer");

        const rect = dragged.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    }

    /* ROTATE ARMS */
    if (e.target.classList.contains("gonio-arm")) {
        rotatingArm = e.target;
    }
});

document.addEventListener("mousemove", e => {

    if (dragged) {

        /* BOARD */
        if (currentMode === "length" && dragged.id === "movable-wall") {
            const ws = document.getElementById("workspace").getBoundingClientRect();
            let x = e.clientX - ws.left;
            x = Math.max(310, Math.min(x, 800));
            dragged.style.left = x + "px";
            currentReading = ((x - 310) * CM_PER_PIXEL );

        }

        /* CALIPER */
        else if (currentMode === "mid_dia") {
            const ws = document.getElementById("workspace").getBoundingClientRect();
            dragged.style.left = (e.clientX - ws.left) + "px";
            dragged.style.top  = (e.clientY - ws.top) + "px";

            const j1 = document.getElementById("caliper-jaw-1").getBoundingClientRect();
            const j2 = document.getElementById("caliper-jaw-2").getBoundingClientRect();
            currentReading = Math.abs(j1.left - j2.left) * 0.03;
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
        dragged.id === "goniometer"
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

    const tolerance = 2.1;

    /* -------- SYSTEM CALCULATES TRUE VALUES -------- */

    const L = REAL_CLAVICLE.length;
    const D = REAL_CLAVICLE.mid_dia;
    const G = REAL_CLAVICLE.least_girth;

    const correct = {
        length: L,
        mid_dia: D,
        least_girth: G, 
        caliber: (D * 100) / L,
        robust: (G * 100) / L
    };

    /* -------- STUDENT VALUES -------- */

    const user = {
        length: parseFloat(document.getElementById("ans_length").value),
        mid_dia: parseFloat(document.getElementById("ans_mid_dia").value),
        least: parseFloat(document.getElementById("ans_least_girth").value),
        caliber: parseFloat(document.getElementById("ans_caliber").value),
        robust: parseFloat(document.getElementById("ans_robust").value)
    };

    let score = 0;
    let total = 5;

    for (let key in correct) {

        const input = document.getElementById("ans_" + key);

        if (Math.abs(user[key] - correct[key]) <= tolerance) {

            input.style.border = "3px solid green";
            input.style.backgroundColor = "#e6ffe6";
            score++;

        } else {

            input.style.border = "3px solid red";
            input.style.backgroundColor = "#ffe6e6";
        }
    }

    const feedback = document.getElementById("IndexFeedback");

    if (score === total) {
        feedback.style.color = "green";
        feedback.innerHTML = `✔ Excellent! All calculations correct. (${score}/5)`;
    } 
    else {
        feedback.style.color = "red";
        feedback.innerHTML = `✖ Some values are incorrect. Score: ${score}/5`;
    }
}


/* ==============================
   INIT
============================== */

setMode("length");





