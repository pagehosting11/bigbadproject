
const API_URL = "https://bigbadproject.ngconghuy4.workers.dev";

// ==========================================
// STATE
// ==========================================

let currentDate = new Date();
let selectedDateKey = null;
let selectedClassId = null;
let classes = [];
let events = {};
let sessionToken = null;
let editMode = false;
let editingEventId = null;

const EVENT_TYPES = {
    HW: {
        label: "HOMEWORK",
        className: ""
    },
    PROJECT: {
        label: "PROJECT",
        className: "project"
    },
    EXAM: {
        label: "EXAM",
        className: "exam"
    }
};

// ==========================================
// HTML ELEMENTS
// ==========================================

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

const sidebarControls = document.getElementById("sidebarControls");
const upcomingEvents = document.getElementById("upcomingEvents");

if (
    !calendar ||
    !monthYear ||
    !previousMonth ||
    !nextMonth ||
    !eventOverlay ||
    !closeButton ||
    !saveButton ||
    !sidebarControls ||
    !upcomingEvents
) {
    throw new Error("Some required HTML elements are missing.");
}

// ==========================================
// API REQUESTS
// ==========================================

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
        body: options.body
            ? JSON.stringify(options.body)
            : undefined
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.error || `Request failed (${response.status}).`
        );
    }

    return result;
}

// ==========================================
// SIDEBAR TOOLBAR
// ==========================================

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

        <button
            id="changePasswordButton"
            type="button"
            hidden
        >
            CHANGE PASSWORD
        </button>

        <button
            id="logoutButton"
            type="button"
            hidden
        >
            LOG OUT
        </button>
    </div>
`;

sidebarControls.appendChild(toolbar);

const classSelector = document.getElementById("classSelector");
const classStatus = document.getElementById("classStatus");

const editButton = document.getElementById("editButton");
const logoutButton = document.getElementById("logoutButton");
const changePasswordButton =
    document.getElementById("changePasswordButton");

// ==========================================
// PASSWORD DIALOG
// ==========================================

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

        cancel.addEventListener("click", () => {
            finish(null);
        });

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                finish(null);
            }
        });

        form.addEventListener("submit", event => {
            event.preventDefault();

            const values = {};

            for (const [name, input] of Object.entries(inputs)) {
                values[name] = input.value;
            }

            finish(values);
        });

        Object.values(inputs)[0]?.focus();
    });
}

// ==========================================
// LOAD CLASSES
// ==========================================

async function loadClasses() {
    try {
        classStatus.textContent = "Loading classes...";

        const result = await apiRequest("/classes");

        classes = result.classes || [];

        if (classes.length === 0) {
            throw new Error("No classes were found.");
        }

        classSelector.innerHTML = "";

        classes.forEach(item => {
            const option = document.createElement("option");

            option.value = item.id;
            option.textContent = item.name;

            classSelector.appendChild(option);
        });

        selectedClassId = classes.some(item => item.id === "10A8")
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

// ==========================================
// LOAD EVENTS
// ==========================================

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
        renderNextDue();

    } catch (error) {
        console.error(error);

        classStatus.textContent = "Could not load events";

        createCalendar();
        renderNextDue();

        alert(error.message);
    }
}

// ==========================================
// NEXT DUE
// ==========================================

function renderNextDue() {
    upcomingEvents.innerHTML = "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = Object.values(events)
        .flat()
        .filter(event => {
            const date = new Date(event.date + "T00:00:00");

            return date >= today;
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

    if (upcoming.length === 0) {
        const empty = document.createElement("p");

        empty.className = "empty-message";
        empty.textContent = "No upcoming events";

        upcomingEvents.appendChild(empty);

        return;
    }

    upcoming.forEach(event => {
        const item = document.createElement("div");
        item.className = "upcoming-item";

        const date = document.createElement("div");
        date.className = "upcoming-date";

        date.textContent = new Date(
            event.date + "T00:00:00"
        ).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit"
        });

        const title = document.createElement("div");
        title.className = "upcoming-title";
        title.textContent = event.title;

        const type = document.createElement("div");

        type.className =
            "upcoming-type " + event.type.toLowerCase();

        type.textContent =
            EVENT_TYPES[event.type]?.label || event.type;

        item.append(date, title, type);

        upcomingEvents.appendChild(item);
    });
}

// ==========================================
// LOGIN
// ==========================================

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

// ==========================================
// LOGOUT
// ==========================================

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

    classStatus.textContent = editMode
        ? `${selectedClassId} · EDITING`
        : `${selectedClassId} · VIEW ONLY`;
}

// ==========================================
// CHANGE PASSWORD
// ==========================================

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

// ==========================================
// CALENDAR RENDERING
// ==========================================

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

    if (startingDay < 0) {
        startingDay = 6;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells before the first day

    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement("div");

        emptyDay.className = "day empty";

        calendar.appendChild(emptyDay);
    }

    // Actual calendar days

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

        // Highlight today

        const today = new Date();

        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            dayElement.classList.add("today");
        }

        // Click a day to create an event

        if (editMode) {
            dayElement.classList.add("editable-day");

            dayElement.addEventListener("click", () => {
                openEventWindow(dateKey);
            });
        }

        // Display events

        if (events[dateKey]) {
            events[dateKey].forEach(event => {
                const typeInfo =
                    EVENT_TYPES[event.type] || EVENT_TYPES.HW;

                const eventElement = document.createElement("div");

                eventElement.className =
                    `event ${typeInfo.className}`;

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
                    const descriptionElement =
                        document.createElement("div");

                    descriptionElement.className = "event-description";
                    descriptionElement.textContent = event.description;

                    eventElement.appendChild(descriptionElement);
                }

                if (editMode) {
                    const deleteButton =
                        document.createElement("button");

                    deleteButton.className = "event-action";
                    deleteButton.type = "button";
                    deleteButton.textContent = "×";
                    deleteButton.title = "Delete event";

                    deleteButton.addEventListener("click", async e => {
                        e.stopPropagation();

                        if (!confirm("Delete this event?")) {
                            return;
                        }

                        await deleteEvent(event.id);
                    });

                    eventElement.appendChild(deleteButton);

                    eventElement.addEventListener("click", e => {
                        e.stopPropagation();

                        openEventWindow(dateKey, event);
                    });
                }

                dayElement.appendChild(eventElement);
            });
        }

        calendar.appendChild(dayElement);
    }
}

// ==========================================
// EVENT FORM
// ==========================================

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

eventOverlay.addEventListener("click", event => {
    if (event.target === eventOverlay) {
        closeEventWindow();
    }
});

// ==========================================
// SAVE EVENT
// ==========================================

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

// ==========================================
// DELETE EVENT
// ==========================================

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

// ==========================================
// CLASS SWITCHING
// ==========================================

classSelector.addEventListener("change", async () => {
    const newClassId = classSelector.value;

    logout();

    selectedClassId = newClassId;

    await loadEvents();
});

// ==========================================
// BUTTON EVENTS
// ==========================================

editButton.addEventListener("click", login);

logoutButton.addEventListener("click", logout);

changePasswordButton.addEventListener(
    "click",
    changePassword
);

// ==========================================
// MONTH NAVIGATION
// ==========================================

previousMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);

    createCalendar();
});

nextMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);

    createCalendar();
});

// ==========================================
// START APPLICATION
// ==========================================

loadClasses();
