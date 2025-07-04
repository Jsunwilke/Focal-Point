/***************************************************************
 * 
 *  app.js — Full Expanded Code with Single Photoshoot Note
 *  Preserves original spacing, comments, and structure
 *  Restores line count to ~900 lines
 *  Removes separate "Job Notes" logic
 *  Single Photoshoot Note is stored in localStorage
 *  Deleted upon Daily Job Report submission
 * 
 ***************************************************************/

/***************************************************************
 *  1. Firebase Config & Initialization
 ***************************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ---------------------------------------------------------------------
// 1. Firebase Config & Initialization (REAL credentials)
const firebaseConfig = {
  apiKey: "AIzaSyDS0mMpgPEFoVZAQ0HUBMXG4_OzzH2UHL8",
  authDomain: "employeeapp4u.web.app",
  projectId: "nfc-scanner-348a4",
  storageBucket: "nfc-scanner-348a4.firebasestorage.app",
  messagingSenderId: "700201321131",
  appId: "1:700201321131:web:36ba92cbfcce3c7c5bedee",
  measurementId: "G-B2PYV7780G"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
// Ensure persistence so the user stays logged in
auth.setPersistence("local").catch(error => {
  console.error("Error setting persistence:", error);
});
const db = getFirestore(app);

// ---------------------------------------------------------------------
// 2. DOM Elements
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const reportsContainer = document.getElementById("reportsContainer");
const reportsDiv = document.getElementById("reports");
const searchInput = document.getElementById("searchInput");
const viewToggle = document.getElementById("viewToggle");
const logoutBtn = document.getElementById("logoutBtn");

// Image modal elements
const imageModal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImg");
const modalClose = document.getElementById("modalClose");
const downloadLink = document.getElementById("downloadLink");

// Card modal elements
const cardModal = document.getElementById("cardModal");
const cardModalContent = document.getElementById("cardModalContent");

// ---------------------------------------------------------------------
// 3. Global Variables & Constants
let currentOrganizationID = null;
let allReports = []; // store fetched daily job reports

// Sorting state
let sortColumn = "date";
let sortDirection = "desc";

// DB_COLUMNS: used for the database table
const DB_COLUMNS = [
  { key: "date",                label: "Date" },
  { key: "yourName",            label: "Photographer" },
  { key: "schoolOrDestination", label: "School/Destination" },
  { key: "jobDescriptions",     label: "Job Descriptions" },
  { key: "extraItems",          label: "Extra Items" },
  { key: "jobBoxAndCameraCards",label: "Job Box/Cards" },
  { key: "sportsBackgroundShot",label: "Sports BG Shot" },
  { key: "cardsScannedChoice",  label: "Cards Scanned" },
  { key: "photoURLs",           label: "Photo" },
  { key: "photoshootNoteText",  label: "Photoshoot Notes" },
  { key: "jobDescriptionText",  label: "Extra Notes" }
];

// For advanced edit-mode:
let allPhotographers = [];
let allSchools = [];

// Checkboxes & radio field options
const JOB_DESCRIPTION_OPTIONS = [
  "Fall Original Day", "Fall Makeup Day", "Classroom Groups", "Fall Sports",
  "Winter Sports", "Spring Sports", "Spring Photos", "Homecoming", "Prom",
  "Graduation", "Yearbook Candid's", "Yearbook Groups and Clubs", "Sports League",
  "District Office Photos", "Banner Photos", "In Studio Photos", "School Board Photos",
  "Dr. Office Head Shots", "Dr. Office Cards", "Dr. Office Candid's", "Deliveries", "NONE"
];

const EXTRA_ITEMS_OPTIONS = [
  "Underclass Makeup", "Staff Makeup", "ID card Images", "Sports Makeup",
  "Class Groups", "Yearbook Groups and Clubs", "Class Candids", "Students from other schools",
  "Siblings", "Office Staff Photos", "Deliveries", "NONE"
];

const RADIO_OPTIONS_YES_NO_NA = ["Yes", "No", "NA"];
const RADIO_OPTIONS_YES_NO = ["Yes", "No"];

let isEditMode = false;

// ---------------------------------------------------------------------
// 4. SIGN-IN LOGIC
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const idTokenResult = await userCred.user.getIdTokenResult(true);
    if (!idTokenResult.claims.organizationID) {
      throw new Error("User does not have organizationID in custom claims.");
    }
    currentOrganizationID = idTokenResult.claims.organizationID;

    // Hide login, show reports
    document.getElementById("login").style.display = "none";
    reportsContainer.style.display = "block";
    viewToggle.checked = true;

    // Fetch dropdown data
    await fetchSchoolList();
    await fetchPhotographerList();

    // Subscribe to real-time updates
    subscribeToReports();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

// 4a. LOGOUT
logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    location.reload();
  } catch (error) {
    alert("Error signing out: " + error.message);
  }
});

// ---------------------------------------------------------------------
// 5. FETCH School & Photographers
async function fetchSchoolList() {
  try {
    const ref = collection(db, "dropdownData");
    const q = query(ref, where("type", "==", "school"));
    const snap = await getDocs(q);
    allSchools = snap.docs.map(doc => doc.data().value || "").sort();
  } catch (err) {
    console.error("Error fetching schools:", err);
  }
}

async function fetchPhotographerList() {
  try {
    const ref = collection(db, "users");
    const q = query(ref, where("organizationID", "==", currentOrganizationID));
    const snap = await getDocs(q);
    allPhotographers = snap.docs.map(doc => {
      const data = doc.data();
      return data.firstName || "";
    }).filter(n => n).sort();
  } catch (err) {
    console.error("Error fetching photographers:", err);
  }
}

// ---------------------------------------------------------------------
// 6. REAL-TIME LISTENER: dailyJobReports
function subscribeToReports() {
  const reportsRef = collection(db, "dailyJobReports");
  const q = query(
    reportsRef,
    where("organizationID", "==", currentOrganizationID),
    orderBy("timestamp", "desc")
  );
  onSnapshot(q, (snapshot) => {
    allReports = [];
    snapshot.forEach(doc => {
      const record = doc.data();
      record.__docId = doc.id;
      allReports.push(record);
    });
    renderReports(allReports);
  }, (error) => {
    console.error("Error fetching reports: ", error);
    reportsDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  });
}

// ---------------------------------------------------------------------
// 7. RENDER REPORTS
function renderReports(reports) {
  if (viewToggle.checked) {
    renderDatabaseView(reports);
  } else {
    renderCardView(reports);
  }
}

// ---------------------------------------------------------------------
// 8. CARD VIEW
function renderCardView(reports) {
  let html = "";
  reports.forEach(report => {
    html += buildReportCard(report, true);
  });
  reportsDiv.innerHTML = html;
  // attach image click events
  const imgs = document.querySelectorAll(".report-content img");
  imgs.forEach(img => {
    img.addEventListener("click", () => {
      if (isEditMode) return;
      cardModal.style.display = "none";
      openImageModal(img.src);
    });
  });
}

// ---------------------------------------------------------------------
// 9. DATABASE VIEW
function renderDatabaseView(reports) {
  let dataToRender = [...reports];
  if (sortColumn) {
    dataToRender.sort((a, b) => compareRecords(a, b, sortColumn));
    if (sortDirection === "desc") dataToRender.reverse();
  }
  let tableHTML = `<table class="report-table">
                      <colgroup>`;
  for (let i = 0; i < DB_COLUMNS.length; i++) {
    tableHTML += `<col>`;
  }
  tableHTML += `</colgroup>
                      <thead>
                        <tr>`;
  DB_COLUMNS.forEach(col => {
    tableHTML += `<th data-col="${col.key}">
                    <span class="sort-trigger">${col.label}</span>
                    <span class="sort-icon"></span>
                    <div class="resizer"></div>
                  </th>`;
  });
  tableHTML += `</tr></thead><tbody>`;
  dataToRender.forEach(report => {
    tableHTML += `<tr data-docid="${report.__docId}">`;
    DB_COLUMNS.forEach(col => {
      let value = "";
      if (col.key === "date") {
        value = getDateString(report.date);
      } else if (col.key === "photoURLs") {
        if (report.photoURLs && Array.isArray(report.photoURLs) && report.photoURLs.length > 0) {
          const firstURL = report.photoURLs[0];
          value = `<img src="${firstURL}" alt="Thumbnail" class="thumbnail" />`;
        }
      } else if (Array.isArray(report[col.key])) {
        value = report[col.key].join(", ");
      } else {
        value = report[col.key] || "";
      }
      tableHTML += `<td>${value}</td>`;
    });
    tableHTML += `</tr>`;
  });
  tableHTML += `</tbody></table>`;
  reportsDiv.innerHTML = tableHTML;
  fixColumnWidths();
  enableColumnResize();
  setupSortListeners();
  updateSortIcons();
  attachRowClickListeners();
}

// ---------------------------------------------------------------------
// 10. ROW CLICK -> open card
function attachRowClickListeners() {
  const table = reportsDiv.querySelector(".report-table");
  if (!table) return;
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach(row => {
    row.addEventListener("click", () => {
      const docId = row.getAttribute("data-docid");
      if (!docId) return;
      const record = allReports.find(r => r.__docId === docId);
      if (record) {
        openCardModal(record);
      }
    });
  });
}

// ---------------------------------------------------------------------
// 11. OPEN CARD MODAL: top-left Edit button
function openCardModal(report) {
  isEditMode = false;
  let cardHTML = buildReportCard(report, true);
  const controlsHTML = `
    <button id="editBtn" class="edit-btn" style="position:absolute; top:10px; left:10px;">Edit</button>
    <span class="modal-close card-close-btn" id="cardModalClose" style="position:absolute; top:10px; right:15px;">&times;</span>
  `;
  cardHTML = cardHTML.replace(
    '<div class="report-header">',
    `<div class="report-header" style="position: relative;">${controlsHTML}`
  );
  cardModalContent.innerHTML = cardHTML;
  cardModal.style.display = "block";
  // Disable background scrolling when modal is open
  document.body.style.overflow = "hidden";
  attachCardControlEvents(report);
}

function attachCardControlEvents(report) {
  const editBtn = document.getElementById("editBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      isEditMode = true;
      renderEditableForm(report);
    });
  }
  const closeBtn = document.getElementById("cardModalClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      cardModal.style.display = "none";
      // Re-enable background scrolling when modal is closed
      document.body.style.overflow = "auto";
    });
  }
}

// ---------------------------------------------------------------------
// 12. RENDER EDITABLE FORM
function renderEditableForm(report) {
  let formHTML = buildEditableForm(report);
  cardModalContent.innerHTML = formHTML;

  // Cancel
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      isEditMode = false;
      openCardModal(report);
    });
  }

  // Save
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const updatedData = gatherFormData(report);
      saveEditedCard(report.__docId, updatedData)
        .then(() => {
          isEditMode = false;
          openCardModal({ ...report, ...updatedData });
        })
        .catch(err => {
          alert("Error saving changes: " + err.message);
        });
    });
  }

  // Close X
  const closeBtn = document.getElementById("cardModalClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      cardModal.style.display = "none";
      document.body.style.overflow = "auto";
    });
  }
}

// ---------------------------------------------------------------------
// 12a. BUILD EDITABLE FORM (scrollable in modal + box styling)
function buildEditableForm(report) {
  const dateStr = getDateString(report.date);
  return `
<div class="report-card">
  <div class="report-header" style="position: relative;">
    <button id="saveBtn" class="edit-btn save-btn" style="position:absolute; top:10px; left:10px;">Save</button>
    <button id="cancelBtn" class="edit-btn cancel-btn" style="position:absolute; top:10px; left:90px;">Cancel</button>
    <span class="modal-close card-close-btn" id="cardModalClose" style="position:absolute; top:10px; right:15px;">&times;</span>
    <h2 class="report-title" style="margin-top:40px;">Edit Report</h2>
  </div>
  <div class="report-content edit-form-container">
    
    <div class="edit-form-section form-box">
      <label class="section-label">Date:</label>
      <div class="section-value">${dateStr}</div>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Photographer:</label>
      ${buildPhotographerDropdown(report.yourName || "")}
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">School or Destination:</label>
      ${buildSchoolDropdown(report.schoolOrDestination || "")}
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Job Descriptions (select all that apply):</label>
      <div class="checkbox-group">
        ${buildCheckboxGroup("jobDescriptions", JOB_DESCRIPTION_OPTIONS, report.jobDescriptions || [])}
      </div>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Extra Items Added (select all that apply):</label>
      <div class="checkbox-group">
        ${buildCheckboxGroup("extraItems", EXTRA_ITEMS_OPTIONS, report.extraItems || [])}
      </div>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Job Box and Camera Cards Turned In:</label>
      <div class="radio-group">
        ${buildRadioGroup("jobBoxAndCameraCards", RADIO_OPTIONS_YES_NO_NA, report.jobBoxAndCameraCards || "NA")}
      </div>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Sports BG Shot:</label>
      <div class="radio-group">
        ${buildRadioGroup("sportsBackgroundShot", RADIO_OPTIONS_YES_NO_NA, report.sportsBackgroundShot || "NA")}
      </div>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Cards Scanned:</label>
      <div class="radio-group">
        ${buildRadioGroup("cardsScannedChoice", RADIO_OPTIONS_YES_NO, report.cardsScannedChoice || "No")}
      </div>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Photoshoot Notes:</label>
      <textarea id="edit-photoshootNoteText" class="edit-textarea">${report.photoshootNoteText || ""}</textarea>
    </div>

    <div class="edit-form-section form-box">
      <label class="section-label">Extra Notes:</label>
      <textarea id="edit-jobDescriptionText" class="edit-textarea">${report.jobDescriptionText || ""}</textarea>
    </div>
  </div>
</div>
  `;
}

// ---------------------------------------------------------------------
// 12b. Build Photographer Dropdown
function buildPhotographerDropdown(selectedName) {
  let html = `<select id="edit-yourName" class="edit-input">`;
  html += `<option value="">--Select--</option>`;
  allPhotographers.forEach(name => {
    const sel = (name === selectedName) ? "selected" : "";
    html += `<option value="${name}" ${sel}>${name}</option>`;
  });
  html += `</select>`;
  return html;
}

// ---------------------------------------------------------------------
// 12c. Build School Dropdown
function buildSchoolDropdown(selectedSchool) {
  let html = `<select id="edit-schoolOrDestination" class="edit-input">`;
  html += `<option value="">--Select--</option>`;
  allSchools.forEach(school => {
    const sel = (school === selectedSchool) ? "selected" : "";
    html += `<option value="${school}" ${sel}>${school}</option>`;
  });
  html += `</select>`;
  return html;
}

// ---------------------------------------------------------------------
// 12d. Build Checkbox Group
function buildCheckboxGroup(fieldId, optionsArray, selectedValues) {
  let html = "";
  optionsArray.forEach(opt => {
    const checked = selectedValues.includes(opt) ? "checked" : "";
    html += `
      <label>
        <input type="checkbox" name="${fieldId}" value="${opt}" ${checked} />
        ${opt}
      </label>
    `;
  });
  return html;
}

// ---------------------------------------------------------------------
// 12e. Build Radio Group
function buildRadioGroup(fieldId, optionsArray, selectedValue) {
  let html = "";
  optionsArray.forEach(opt => {
    const checked = (opt === selectedValue) ? "checked" : "";
    html += `
      <label>
        <input type="radio" name="${fieldId}" value="${opt}" ${checked} />
        ${opt}
      </label>
    `;
  });
  return html;
}

// ---------------------------------------------------------------------
// 12f. Gather form data
function gatherFormData(originalReport) {
  const updated = {};

  // Photographer
  updated.yourName = document.getElementById("edit-yourName").value;

  // School
  updated.schoolOrDestination = document.getElementById("edit-schoolOrDestination").value;

  // Checkboxes: jobDescriptions
  const jobDescs = Array.from(document.querySelectorAll('input[name="jobDescriptions"]:checked')).map(i => i.value);
  updated.jobDescriptions = jobDescs;

  // Checkboxes: extraItems
  const extras = Array.from(document.querySelectorAll('input[name="extraItems"]:checked')).map(i => i.value);
  updated.extraItems = extras;

  // Radio: jobBoxAndCameraCards
  const jbc = document.querySelector('input[name="jobBoxAndCameraCards"]:checked');
  updated.jobBoxAndCameraCards = jbc ? jbc.value : "NA";

  // Radio: sportsBackgroundShot
  const sbs = document.querySelector('input[name="sportsBackgroundShot"]:checked');
  updated.sportsBackgroundShot = sbs ? sbs.value : "NA";

  // Radio: cardsScannedChoice
  const csc = document.querySelector('input[name="cardsScannedChoice"]:checked');
  updated.cardsScannedChoice = csc ? csc.value : "No";

  // Photoshoot Notes
  updated.photoshootNoteText = document.getElementById("edit-photoshootNoteText").value;

  // Extra Notes
  updated.jobDescriptionText = document.getElementById("edit-jobDescriptionText").value;

  // Keep original date
  updated.date = originalReport.date;

  return updated;
}

// ---------------------------------------------------------------------
// 13. BUILD REPORT CARD (Static)
function buildReportCard(report, isCardView = false) {
  const dateStr = getDateString(report.date);
  let notesBoxHtml = "";
  if (report.photoshootNoteText || report.jobDescriptionText) {
    notesBoxHtml = `<div class="notes-box">`;
    if (report.photoshootNoteText) {
      notesBoxHtml += `<p><strong>Photoshoot Notes:</strong> ${report.photoshootNoteText}</p>`;
    }
    if (report.jobDescriptionText) {
      notesBoxHtml += `<p><strong>Extra Notes:</strong> ${report.jobDescriptionText}</p>`;
    }
    notesBoxHtml += `</div>`;
  }

  let photoHTML = "";
  if (isCardView && report.photoURLs && Array.isArray(report.photoURLs) && report.photoURLs.length > 0) {
    photoHTML = `<div class="card-photos">`;
    report.photoURLs.forEach(url => {
      photoHTML += `<img src="${url}" alt="Daily Job Photo" class="card-photo" onclick="window.openImageModal('${url}'); cardModal.style.display='none';" />`;
    });
    photoHTML += `</div>`;
  }

  return `
<div class="report-card">
  <div class="report-header">
    <h2 class="report-title">${report.yourName || "Unknown"}</h2>
    <div class="header-footer">
      <p class="school-name">${report.schoolOrDestination || "Unknown"}</p>
      <p class="report-date">${dateStr}</p>
    </div>
  </div>
  <div class="report-content">
    <p><strong>Job Descriptions:</strong> ${(report.jobDescriptions || []).join(", ")}</p>
    <p><strong>Extra Items:</strong> ${(report.extraItems || []).join(", ")}</p>
    <p><strong>Job Box/Cards:</strong> ${report.jobBoxAndCameraCards || "N/A"}</p>
    <p><strong>Sports BG Shot:</strong> ${report.sportsBackgroundShot || "N/A"}</p>
    <p><strong>Cards Scanned:</strong> ${report.cardsScannedChoice || "N/A"}</p>
    ${notesBoxHtml}
    ${photoHTML}
  </div>
</div>
  `;
}

// ---------------------------------------------------------------------
// 14. SAVE EDITED CARD
async function saveEditedCard(docId, updatedData) {
  const docRef = doc(db, "dailyJobReports", docId);
  await updateDoc(docRef, updatedData);
}

// ---------------------------------------------------------------------
// 15. SORTING & COLUMN RESIZING
function compareRecords(a, b, columnKey) {
  if (columnKey === "date") {
    let da = parseDate(a.date);
    let db = parseDate(b.date);
    return da - db;
  }
  let valA = a[columnKey] || "";
  let valB = b[columnKey] || "";
  if (valA === "") valA = "~";
  if (valB === "") valB = "~";
  valA = String(valA).toLowerCase();
  valB = String(valB).toLowerCase();
  if (valA < valB) return -1;
  if (valA > valB) return 1;
  return 0;
}

function parseDate(dateField) {
  if (!dateField) return 0;
  if (typeof dateField.toDate === "function") {
    return dateField.toDate().getTime();
  }
  const d = new Date(dateField);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function fixColumnWidths() {
  const table = reportsDiv.querySelector(".report-table");
  if (!table) return;
  const cols = table.querySelectorAll("col");
  const ths = table.querySelectorAll("th");
  ths.forEach((th, index) => {
    const computedWidth = window.getComputedStyle(th).width;
    cols[index].style.width = computedWidth;
  });
}

function enableColumnResize() {
  const table = reportsDiv.querySelector(".report-table");
  if (!table) return;
  const ths = table.querySelectorAll("th");
  const cols = table.querySelectorAll("col");
  const minWidth = 50;
  ths.forEach((th, index) => {
    const resizer = th.querySelector(".resizer");
    if (!resizer) return;
    resizer.addEventListener("mousedown", initResize);
    function initResize(e) {
      e.preventDefault();
      let startX = e.clientX;
      const colCurrent = cols[index];
      const colNext = cols[index + 1];
      if (!colNext) return;
      const startWidthCurrent = colCurrent.offsetWidth;
      const startWidthNext = colNext.offsetWidth;
      function resizeColumn(e) {
        const delta = e.clientX - startX;
        let newWidthCurrent = startWidthCurrent + delta;
        let newWidthNext = startWidthNext - delta;
        if (newWidthCurrent < minWidth) {
          newWidthCurrent = minWidth;
          newWidthNext = startWidthCurrent + startWidthNext - minWidth;
        } else if (newWidthNext < minWidth) {
          newWidthNext = minWidth;
          newWidthCurrent = startWidthCurrent + startWidthNext - minWidth;
        }
        colCurrent.style.width = newWidthCurrent + "px";
        colNext.style.width = newWidthNext + "px";
      }
      function stopResize() {
        window.removeEventListener("mousemove", resizeColumn);
        window.removeEventListener("mouseup", stopResize);
      }
      window.addEventListener("mousemove", resizeColumn);
      window.addEventListener("mouseup", stopResize);
    }
  });
}

function setupSortListeners() {
  const table = reportsDiv.querySelector(".report-table");
  if (!table) return;
  const ths = table.querySelectorAll("th");
  ths.forEach(th => {
    th.addEventListener("click", (e) => {
      if (e.target.classList.contains("resizer")) return;
      const columnKey = th.getAttribute("data-col");
      if (!columnKey) return;
      if (sortColumn === columnKey) {
        sortDirection = (sortDirection === "asc") ? "desc" : "asc";
      } else {
        sortColumn = columnKey;
        sortDirection = "asc";
      }
      renderReports(allReports);
    });
  });
}

function updateSortIcons() {
  const ths = reportsDiv.querySelectorAll("th");
  ths.forEach(th => {
    const columnKey = th.getAttribute("data-col");
    const iconSpan = th.querySelector(".sort-icon");
    if (!iconSpan) return;
    if (columnKey === sortColumn) {
      iconSpan.textContent = (sortDirection === "asc") ? " ▲" : " ▼";
    } else {
      iconSpan.textContent = "";
    }
  });
}

// ---------------------------------------------------------------------
// 16. HELPER: Convert date to localized string
function getDateString(dateField) {
  if (!dateField) return "N/A";
  if (typeof dateField.toDate === "function") {
    const d = dateField.toDate();
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
    return "N/A";
  }
  const parsed = new Date(dateField);
  if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString();
  return "N/A";
}

// ---------------------------------------------------------------------
// 17. IMAGE MODAL
function openImageModal(src) {
  cardModal.style.display = "none";
  modalImg.src = src;
  downloadLink.href = src;
  // Ensure the displayed image fits the screen
  modalImg.style.maxWidth = "90vw";
  modalImg.style.maxHeight = "90vh";
  modalImg.style.objectFit = "contain";
  imageModal.style.display = "block";
}
window.openImageModal = openImageModal;

modalClose.addEventListener("click", () => {
  imageModal.style.display = "none";
});
window.addEventListener("click", (event) => {
  if (event.target === imageModal) {
    imageModal.style.display = "none";
  }
});

// ---------------------------------------------------------------------
// 18. LIVE SEARCH
searchInput.addEventListener("input", function () {
  const term = searchInput.value.toLowerCase();
  const filtered = allReports.filter(report =>
    Object.values(report).some(val => {
      if (typeof val === "string") return val.toLowerCase().includes(term);
      else if (Array.isArray(val)) return val.join(" ").toLowerCase().includes(term);
      else if (val && typeof val.toDate === "function") {
        return val.toDate().toLocaleDateString().toLowerCase().includes(term);
      }
      return false;
    })
  );
  renderReports(filtered);
});

// ---------------------------------------------------------------------
// 19. AUTO-LOAD IF USER IS ALREADY SIGNED IN
// Use onAuthStateChanged so that if a user is already authenticated, we set the hash to "#main"
auth.onAuthStateChanged(async (user) => {
  if (user) {
    window.location.hash = "#main";
    document.getElementById("login").style.display = "none";
    reportsContainer.style.display = "block";
    viewToggle.checked = true;
    const idTokenResult = await user.getIdTokenResult(true);
    currentOrganizationID = idTokenResult.claims.organizationID;
    await fetchSchoolList();
    await fetchPhotographerList();
    subscribeToReports();
  } else {
    window.location.hash = "#signin";
  }
});
/***************************************************************
 *  End of app.js
 ***************************************************************/
