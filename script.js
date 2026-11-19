
const API_URL = "https://bigbadproject.ngconghuy4.workers.dev";

let currentDate = new Date();
let selectedDateKey = null;
let selectedClassId = null;
let classes = [];
let events = {};
let sessionToken = null;
let editMode = false;
let editingEventId = null;

const EVENT_TYPES = {
    HW: { label: "HOMEWORK", className: "" },
    PROJECT: { label: "PROJECT", className: "project" },
    EXAM: { label: "EXAM", className: "exam" }
};

const calendar = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");
const previousMonth = document.getElementById("previousMonth");
const nextMonth = document.getElementById("nextMonth");

const eventOverlay = document.getElementById("eventOverlay");
const closeButton = document.getElementById("closeEvent");
const saveButton = document.getElementById("saveEvent");

const eventType = document.getElementById("eventType");
const eventTitle = document.getElementById("eventTitle");
const eventDescription = document.getElementById("eventDescription");
const selectedDate = document.getElementById("selectedDate");

if (
    !calendar ||
    !monthYear ||
    !previousMonth ||
    !nextMonth ||
    !eventOverlay ||
    !closeButton ||
    !saveButton
) {
    throw new Error("Some required calendar HTML elements are missing.");
}

// ---------- API REQUESTS ----------

async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (options.auth && sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(result.error || `Request failed (${response.status}).`);
    }

    return result;
}

// ---------- TOOLBAR ----------

const toolbar = document.createElement("div");

toolbar.id = "calendarToolbar";

toolbar.innerHTML = `
    <div class="toolbar-left">
        <label for="classSelector">CLASS</label>
        <select id="classSelector"></select>
        <span id="classStatus">Loading...</span>
    </div>

    <div class="toolbar-right">
        <button id="editButton" type="button">EDIT</button>
        <button id="changePasswordButton" type="button" hidden>
            CHANGE PASSWORD
        </button>
        <button id="logoutButton" type="button" hidden>
            LOG OUT
        </button>
    </div>
`;

const calendarContainer = document.querySelector(".calendar-container");

calendarContainer.prepend(toolbar);

const classSelector = document.getElementById("classSelector");
const classStatus = document.getElementById("classStatus");

const editButton = document.getElementById("editButton");
const logoutButton = document.getElementById("logoutButton");
const changePasswordButton = document.getElementById("changePasswordButton");

// ---------- TOOLBAR STYLING ----------

const toolbarStyle = document.createElement("style");

toolbarStyle.textContent = `
    #calendarToolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #dce2e8;
    }

    .toolbar-left,
    .toolbar-right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
    }

    .toolbar-left label {
        font-size: 12px;
        font-weight: bold;
        color: #64748b;
    }

    #classSelector,
    #calendarToolbar button {
        padding: 9px 13px;
        border: 1px solid #d5dbe3;
        border-radius: 7px;
        background: white;
        color: #17202a;
        font-size: 13px;
        cursor: pointer;
    }

    #calendarToolbar button:hover {
        background: #eef2f7;
    }

    #editButton {
        background: #4f7cff;
        color: white;
        border-color: #4f7cff;
        font-weight: bold;
    }

    #editButton:hover {
        background: #3b67df;
    }

    #classStatus {
        font-size: 12px;
        color: #64748b;
    }

    .event.editable {
        cursor: pointer;
    }

    .event.editable:hover {
        outline: 2px solid #4f7cff;
    }

    .event-action {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 25px;
        height: 25px;
        border: 1px solid #d5dbe3;
        border-radius: 6px;
        background: white;
        color: #dc2626;
        cursor: pointer;
        font-size: 15px;
    }

    .event-action:hover {
        background: #fee2e2;
    }

    .day.editable-day {
        cursor: pointer;
    }

    .day.editable-day:hover {
        background: #f0f5ff;
    }

    .password-dialog-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(15, 23, 42, .5);
        z-index: 3000;
    }

    .password-dialog {
        width: min(400px, 100%);
        padding: 25px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 15px 40px rgba(0,0,0,.2);
    }

    .password-dialog h2 {
        margin: 0 0 18px;
        font-size: 21px;
    }

    .password-dialog label {
        display: block;
        margin: 13px 0 6px;
        font-size: 13px;
        font-weight: bold;
        color: #475569;
    }

    .password-dialog input {
        width: 100%;
        padding: 11px;
        border: 1px solid #d5dbe3;
        border-radius: 7px;
        font-size: 15px;
    }

    .password-dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
    }

    .password-dialog-actions button {
        padding: 10px 15px;
        border: 1px solid #d5dbe3;
        border-radius: 7px;
        background: white;
        cursor: pointer;
    }

    .password-dialog-actions button[type="submit"] {
        background: #4f7cff;
        border-color: #4f7cff;
        color: white;
    }

    @media (max-width: 600px) {
        #calendarToolbar {
            align-items: flex-start;
        }

        .toolbar-right {
            width: 100%;
        }
    }
`;

document.head.appendChild(toolbarStyle);

// ---------- PASSWORD DIALOG ----------

function passwordDialog(title, fields) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "password-dialog-overlay";

        const form = document.createElement("form");
        form.className = "password-dialog";

        const heading = document.createElement("h2");
        heading.textContent = title;
        form.appendChild(heading);

        const inputs = {};

        fields.forEach(field => {
            const label = document.createElement("label");
            label.textContent = field.label;

            const input = document.createElement("input");
            input.type = "password";
            input.required = true;
            input.minLength = field.minLength || 1;
            input.autocomplete = "off";

            inputs[field.name] = input;

            form.append(label, input);
        });

        const actions = document.createElement("div");
        actions.className = "password-dialog-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "CANCEL";

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.textContent = "CONTINUE";

        actions.append(cancel, submit);
        form.appendChild(actions);
        overlay.appendChild(form);
        document.body.appendChild(overlay);

        function finish(value) {
            overlay.remove();
            resolve(value);
        }

        cancel.addEventListener("click", () => finish(null));

        overlay.addEventListener("click", e => {
            if (e.target === overlay) finish(null);
        });

        form.addEventListener("submit", e => {
            e.preventDefault();

            const values = {};

            for (const [name, input] of Object.entries(inputs)) {
                values[name] = input.value;
            }

            finish(values);
        });

        Object.values(inputs)[0]?.focus();
    });
}

// ---------- CLASS LOADING ----------

async function loadClasses() {
    try {
        const result = await apiRequest("/classes");

        classes = result.classes || [];

        if (!classes.length) {
            throw new Error("No classes were found.");
        }

        classSelector.innerHTML = "";

        classes.forEach(item => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            classSelector.appendChild(option);
        });

        selectedClassId = classes.some(c => c.id === "10A8")
            ? "10A8"
            : classes[0].id;

        classSelector.value = selectedClassId;

        await loadEvents();

    } catch (error) {
        console.error(error);
        classStatus.textContent = "Could not load classes";
        alert(error.message);
    }
}

// ---------- EVENT LOADING ----------

async function loadEvents() {
    events = {};

    classStatus.textContent = `Loading ${selectedClassId}...`;

    try {
        const result = await apiRequest(
            `/events?classId=${encodeURIComponent(selectedClassId)}`
        );

        (result.events || []).forEach(event => {
            if (!events[event.date]) {
                events[event.date] = [];
            }

            events[event.date].push(event);
        });

        classStatus.textContent = editMode
            ? `${selectedClassId} · EDITING`
            : `${selectedClassId} · VIEW ONLY`;

        createCalendar();

    } catch (error) {
        console.error(error);
        classStatus.textContent = "Could not load events";
        createCalendar();
        alert(error.message);
    }
}

// ---------- LOGIN ----------

async function login() {
    const values = await passwordDialog(
        `Edit ${selectedClassId}`,
        [
            {
                name: "password",
                label: "Class password"
            }
        ]
    );

    if (!values) return false;

    try {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: {
                classId: selectedClassId,
                password: values.password
            }
        });

        sessionToken = result.token;
        editMode = true;

        updateToolbar();
        createCalendar();

        return true;

    } catch (error) {
        alert(error.message);
        return false;
    }
}

// ---------- LOGOUT ----------

function logout() {
    sessionToken = null;
    editMode = false;
    editingEventId = null;

    closeEventWindow();
    updateToolbar();
    createCalendar();
}

function updateToolbar() {
    editButton.hidden = editMode;
    logoutButton.hidden = !editMode;
    changePasswordButton.hidden = !editMode;

    editButton.textContent = "EDIT";

    classStatus.textContent = editMode
        ? `${selectedClassId} · EDITING`
        : `${selectedClassId} · VIEW ONLY`;
}

// ---------- CHANGE PASSWORD ----------

async function changePassword() {
    const values = await passwordDialog(
        `Change ${selectedClassId} password`,
        [
            {
                name: "currentPassword",
                label: "Current password"
            },
            {
                name: "newPassword",
                label: "New password (minimum 10 characters)",
                minLength: 10
            },
            {
                name: "confirmPassword",
                label: "Confirm new password",
                minLength: 10
            }
        ]
    );

    if (!values) return;

    if (values.newPassword !== values.confirmPassword) {
        alert("The new passwords do not match.");
        return;
    }

    try {
        await apiRequest("/auth/change-password", {
            method: "POST",
            auth: true,
            body: {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword
            }
        });

        alert("Password changed successfully. Please log in again.");

        logout();

    } catch (error) {
        alert(error.message);
    }
}

// ---------- CALENDAR RENDERING ----------

function createCalendar() {
    calendar.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYear.textContent = currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });

    const firstDay = new Date(year, month, 1);
    let startingDay = firstDay.getDay() - 1;

    if (startingDay < 0) startingDay = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement("div");
        emptyDay.className = "day empty";
        calendar.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement("div");
        dayElement.className = "day";

        const date = new Date(year, month, day);

        const dateKey =
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const weekday = date.toLocaleDateString("en-US", {
            weekday: "short"
        });

        const dayNumber = document.createElement("div");
        dayNumber.className = "day-number";

        dayNumber.textContent =
            `${weekday} ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;

        dayElement.appendChild(dayNumber);

        const today = new Date();

        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            dayElement.classList.add("today");
        }

        if (editMode) {
            dayElement.classList.add("editable-day");

            dayElement.addEventListener("click", () => {
                openEventWindow(dateKey);
            });
        }

        if (events[dateKey]) {
            events[dateKey].forEach(event => {
                const typeInfo =
                    EVENT_TYPES[event.type] || EVENT_TYPES.HW;

                const eventElement = document.createElement("div");
                eventElement.className = `event ${typeInfo.className}`;

                if (editMode) {
                    eventElement.classList.add("editable");
                }

                const typeElement = document.createElement("div");
                typeElement.className = "event-type";
                typeElement.textContent = typeInfo.label;

                const titleElement = document.createElement("div");
                titleElement.className = "event-title";
                titleElement.textContent = event.title;

                eventElement.append(typeElement, titleElement);

                if (event.description) {
                    const descriptionElement = document.createElement("div");
                    descriptionElement.className = "event-description";
                    descriptionElement.textContent = event.description;
                    eventElement.appendChild(descriptionElement);
                }

                if (editMode) {
                    const deleteButton = document.createElement("button");

                    deleteButton.className = "event-action";
                    deleteButton.type = "button";
                    deleteButton.textContent = "×";
                    deleteButton.title = "Delete event";

                    deleteButton.addEventListener("click", async e => {
                        e.stopPropagation();

                        if (!confirm("Delete this event?")) return;

                        await deleteEvent(event.id);
                    });

                    eventElement.appendChild(deleteButton);

                    eventElement.addEventListener("click", e => {
                        if (e.target === deleteButton) return;
                        openEventWindow(dateKey, event);
                    });
                }

                dayElement.appendChild(eventElement);
            });
        }

        calendar.appendChild(dayElement);
    }
}

// ---------- EVENT FORM ----------

function openEventWindow(dateKey, event = null) {
    if (!editMode) return;

    selectedDateKey = dateKey;
    editingEventId = event?.id || null;

    selectedDate.textContent = event
        ? `Edit event · ${dateKey}`
        : `New event · ${dateKey}`;

    eventType.value = event?.type || "HW";
    eventTitle.value = event?.title || "";
    eventDescription.value = event?.description || "";

    saveButton.textContent = event ? "UPDATE" : "SAVE";

    eventOverlay.classList.add("active");
}

function closeEventWindow() {
    eventOverlay.classList.remove("active");

    selectedDateKey = null;
    editingEventId = null;

    saveButton.textContent = "SAVE";
}

closeButton.addEventListener("click", closeEventWindow);

eventOverlay.addEventListener("click", e => {
    if (e.target === eventOverlay) {
        closeEventWindow();
    }
});

// ---------- SAVE EVENT ----------

saveButton.addEventListener("click", async () => {
    if (!selectedDateKey || !editMode) return;

    const title = eventTitle.value.trim();
    const description = eventDescription.value.trim();
    const type = eventType.value;

    if (!title) {
        alert("Please enter an event title.");
        return;
    }

    const body = {
        date: selectedDateKey,
        type,
        title,
        description
    };

    saveButton.disabled = true;

    try {
        if (editingEventId) {
            await apiRequest(
                `/events/${encodeURIComponent(editingEventId)}`,
                {
                    method: "PUT",
                    auth: true,
                    body
                }
            );
        } else {
            await apiRequest("/events", {
                method: "POST",
                auth: true,
                body
            });
        }

        closeEventWindow();
        await loadEvents();

    } catch (error) {
        console.error(error);
        alert(`Could not save event: ${error.message}`);
    } finally {
        saveButton.disabled = false;
    }
});

// ---------- DELETE EVENT ----------

async function deleteEvent(eventId) {
    try {
        await apiRequest(
            `/events/${encodeURIComponent(eventId)}`,
            {
                method: "DELETE",
                auth: true
            }
        );

        await loadEvents();

    } catch (error) {
        alert(`Could not delete event: ${error.message}`);
    }
}

// ---------- CLASS SWITCHING ----------

classSelector.addEventListener("change", async () => {
    const newClassId = classSelector.value;

    logout();

    selectedClassId = newClassId;

    await loadEvents();
});

// ---------- BUTTONS ----------

editButton.addEventListener("click", login);

logoutButton.addEventListener("click", logout);

changePasswordButton.addEventListener("click", changePassword);

// ---------- MONTH NAVIGATION ----------

previousMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    createCalendar();
});

nextMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    createCalendar();
});

// ---------- START ----------

loadClasses();
