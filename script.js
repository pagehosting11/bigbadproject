import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";


// FIREBASE CONFIGURATION

const firebaseConfig = {
    apiKey: "AIzaSyAZiyg1XA0FRdUpOMGmRH8sBJqfkmEXETc",
    authDomain: "big-bad-project.firebaseapp.com",
    projectId: "big-bad-project",
    storageBucket: "big-bad-project.firebasestorage.app",
    messagingSenderId: "685537913089",
    appId: "1:685537913089:web:41f6fd17c3c038e6141300"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// APP STATE

let currentDate = new Date();
let selectedClassId = "";
let events = {};

let classes = [];


// EVENT TYPES

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


// HTML ELEMENTS

const calendar = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");

const previousMonth = document.getElementById("previousMonth");
const nextMonth = document.getElementById("nextMonth");

const calendarContainer =
    document.querySelector(".calendar-container");


if (
    !calendar ||
    !monthYear ||
    !previousMonth ||
    !nextMonth ||
    !calendarContainer
) {
    throw new Error(
        "Calendar HTML is missing a required element."
    );
}


// CREATE CLASS SELECTOR

const classControls = document.createElement("div");

classControls.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
`;

const classLabel = document.createElement("label");

classLabel.textContent = "CLASS";

classLabel.style.cssText = `
    font-size: 13px;
    font-weight: 700;
    color: #64748b;
`;

const classSelector = document.createElement("select");

classSelector.style.cssText = `
    min-width: 150px;
    padding: 10px 14px;
    border: 1px solid #d5dbe3;
    border-radius: 8px;
    background: white;
    color: #17202a;
    font-size: 14px;
    cursor: pointer;
`;

classLabel.htmlFor = "classSelector";
classSelector.id = "classSelector";

classControls.append(
    classLabel,
    classSelector
);

calendarContainer.prepend(classControls);


// STATUS

const status = document.createElement("p");

status.style.cssText = `
    margin: 0 0 14px;
    text-align: center;
    font-size: 12px;
    letter-spacing: .08em;
    color: #64748b;
`;

calendarContainer.insertBefore(
    status,
    calendarContainer.querySelector(".calendar-header")
);


// LOAD CLASSES FROM FIRESTORE

async function loadClasses() {

    try {

        status.textContent = "LOADING CLASSES...";

        const snapshot = await getDocs(
            collection(db, "classes")
        );

        classes = [];

        snapshot.forEach((document) => {

            const data = document.data();

            classes.push({
                id: document.id,
                name: data.name || document.id
            });

        });


        classes.sort((a, b) =>
            a.id.localeCompare(b.id)
        );


        if (classes.length === 0) {

            status.textContent = "NO CLASSES FOUND";

            calendar.innerHTML = "";

            return;

        }


        // POPULATE SELECTOR

        classSelector.innerHTML = "";

        classes.forEach((classItem) => {

            const option = document.createElement("option");

            option.value = classItem.id;
            option.textContent = classItem.name;

            classSelector.appendChild(option);

        });


        // SELECT 10A8 BY DEFAULT IF AVAILABLE

        const defaultClass = classes.find(
            item => item.id === "10A8"
        );

        selectedClassId = defaultClass
            ? defaultClass.id
            : classes[0].id;

        classSelector.value = selectedClassId;


        await loadEvents();


    } catch (error) {

        console.error("Could not load classes:", error);

        status.textContent = "FAILED TO LOAD CLASSES";

        alert(
            "Could not load classes from Firestore.\n\n" +
            error.message
        );

    }

}


// LOAD EVENTS FOR SELECTED CLASS

async function loadEvents() {

    if (!selectedClassId) return;

    try {

        status.textContent =
            `LOADING ${selectedClassId}...`;

        calendar.innerHTML = "";

        const eventsCollection = collection(
            db,
            "classes",
            selectedClassId,
            "events"
        );

        const snapshot = await getDocs(eventsCollection);

        events = {};


        snapshot.forEach((document) => {

            const event = document.data();

            if (!event.date || !event.title) {

                console.warn(
                    "Skipping incomplete event:",
                    document.id
                );

                return;

            }


            if (!events[event.date]) {
                events[event.date] = [];
            }


            events[event.date].push({

                id: document.id,

                type: EVENT_TYPES[event.type]
                    ? event.type
                    : "HW",

                title: event.title,

                description: event.description || ""

            });

        });


        status.textContent =
            `CLASS ${selectedClassId} · VIEW ONLY`;

        createCalendar();

        console.log(
            `Loaded events for ${selectedClassId}:`,
            events
        );


    } catch (error) {

        console.error("Firestore error:", error);

        status.textContent =
            `COULD NOT LOAD ${selectedClassId}`;

        calendar.innerHTML = "";

        alert(
            "Could not load calendar data.\n\n" +
            error.message
        );

    }

}


// SWITCH CLASSES

classSelector.addEventListener("change", async () => {

    selectedClassId = classSelector.value;

    await loadEvents();

});


// CREATE CALENDAR

function createCalendar() {

    calendar.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();


    monthYear.textContent = currentDate.toLocaleDateString(
        "en-US",
        {
            month: "long",
            year: "numeric"
        }
    );


    const firstDay = new Date(year, month, 1);

    let startingDay = firstDay.getDay() - 1;

    if (startingDay < 0) {
        startingDay = 6;
    }


    const daysInMonth = new Date(
        year,
        month + 1,
        0
    ).getDate();


    // EMPTY DAYS

    for (let i = 0; i < startingDay; i++) {

        const emptyDay = document.createElement("div");

        emptyDay.className = "day empty";

        calendar.appendChild(emptyDay);

    }


    // MONTH DAYS

    for (let day = 1; day <= daysInMonth; day++) {

        const dayElement = document.createElement("div");

        dayElement.className = "day";


        const date = new Date(year, month, day);


        const dateKey =
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


        const weekday = date.toLocaleDateString(
            "en-US",
            {
                weekday: "short"
            }
        );


        const dayNumber = document.createElement("div");

        dayNumber.className = "day-number";

        dayNumber.textContent =
            `${weekday} ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;

        dayElement.appendChild(dayNumber);


        // TODAY

        const today = new Date();

        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {

            dayElement.classList.add("today");

        }


        // EVENTS

        if (events[dateKey]) {

            events[dateKey].forEach((event) => {

                const typeInfo =
                    EVENT_TYPES[event.type] || EVENT_TYPES.HW;


                const eventElement =
                    document.createElement("div");

                eventElement.className =
                    `event ${typeInfo.className}`;


                const typeElement =
                    document.createElement("div");

                typeElement.className = "event-type";

                typeElement.textContent = typeInfo.label;


                const titleElement =
                    document.createElement("div");

                titleElement.className = "event-title";

                titleElement.textContent = event.title;


                eventElement.append(
                    typeElement,
                    titleElement
                );


                if (event.description) {

                    const descriptionElement =
                        document.createElement("div");

                    descriptionElement.className =
                        "event-description";

                    descriptionElement.textContent =
                        event.description;

                    eventElement.appendChild(
                        descriptionElement
                    );

                }


                dayElement.appendChild(eventElement);

            });

        }


        calendar.appendChild(dayElement);

    }

}


// MONTH NAVIGATION

previousMonth.addEventListener("click", () => {

    currentDate.setMonth(
        currentDate.getMonth() - 1
    );

    createCalendar();

});


nextMonth.addEventListener("click", () => {

    currentDate.setMonth(
        currentDate.getMonth() + 1
    );

    createCalendar();

});


// START APP

loadClasses();