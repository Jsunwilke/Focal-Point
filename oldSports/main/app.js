// Set up the create job form
function setupCreateJobForm() {
    const createJobForm = document.getElementById('createJobForm');
    const createJobBtn = document.getElementById('createJobBtn');
    const createJobModal = document.getElementById('createJobModal');
    
    if (!createJobForm || !createJobBtn || !createJobModal) {
        console.log("Create job form elements not found");
        return;
    }
    
    console.log("Setting up create job form");
    
    const bsCreateJobModal = new bootstrap.Modal(createJobModal);
    
    createJobBtn.addEventListener('click', () => {
        // Validate form
        if (!createJobForm.checkValidity()) {
            createJobForm.reportValidity();
            return;
        }
        
        // Disable button and show loading state
        createJobBtn.disabled = true;
        createJobBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';
        
        // Get form values
        const schoolNameSelect = document.getElementById('schoolName');
        const schoolName = schoolNameSelect.value.trim();
        const seasonType = document.getElementById('seasonType').value.trim();
        const sportName = document.getElementById('sportName').value.trim();
        const shootDateStr = document.getElementById('shootDate').value.trim();
        const location = document.getElementById('location').value.trim();
        const photographer = document.getElementById('photographer').value.trim();
        const additionalNotes = document.getElementById('additionalNotes').value.trim();
        
        // Parse date
        const shootDate = new Date(shootDateStr);
        
        // Get roster data from the file preview or use empty array
        const roster = rosterData.length > 0 ? rosterData : [];
        
        // Create job object
        const job = {
            schoolName,
            seasonType,
            sportName,
            shootDate,
            location,
            photographer,
            additionalNotes,
            roster,
            groupImages: [],
            organizationID: currentOrganizationID,
            isArchived: false, // New jobs always start as not archived
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Save to Firestore
        db.collection(SPORTS_JOBS_COLLECTION).add(job)
            .then((docRef) => {
                console.log("Job created with ID:", docRef.id);
                
                // Reset form
                createJobForm.reset();
                
                // Clear roster data
                rosterData = [];
                
                // Hide file preview
                document.getElementById('filePreview').classList.add('d-none');
                
                // Close modal
                bsCreateJobModal.hide();
                
                // Reload jobs
                loadJobs(false);
                
                // Show success message
                showToast("Success", "Sports job created successfully");
            })
            .catch((error) => {
                console.error("Error creating job:", error);
                showToast("Error", "Failed to create job: " + error.message, "error");
            })
            .finally(() => {
                // Re-enable button
                createJobBtn.disabled = false;
                createJobBtn.innerHTML = 'Create Job';
            });
    });
}

// Set up roster file upload functionality
function setupRosterFileUpload() {
    const rosterFile = document.getElementById('rosterFile');
    const filePreview = document.getElementById('filePreview');
    const previewContainer = document.getElementById('previewContainer');
    const previewStats = document.getElementById('previewStats');
    const refreshPreviewBtn = document.getElementById('refreshPreview');
    
    if (!rosterFile || !filePreview || !previewContainer || !previewStats || !refreshPreviewBtn) {
        console.log("Roster file upload elements not found");
        return;
    }
    
    console.log("Setting up roster file upload");
    
    rosterFile.addEventListener('change', handleFileSelect);
    refreshPreviewBtn.addEventListener('click', () => handleFileSelect({ target: rosterFile }));
    
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            // Clear preview if no file selected
            filePreview.classList.add('d-none');
            rosterData = [];
            return;
        }
        
        console.log("File selected:", file.name, "Size:", file.size, "bytes");
        
        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast("Error", "File is too large. Please select a file smaller than 10MB.", "error");
            rosterFile.value = '';
            return;
        }
        
        // Check file type
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv'
        ];
        
        if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/)) {
            showToast("Error", "Please select a valid Excel (.xlsx, .xls) or CSV file.", "error");
            rosterFile.value = '';
            return;
        }
        
        // Show processing indicator
        showProcessingIndicator();
        
        // Set up timeout to prevent hanging
        const timeoutId = setTimeout(() => {
            hideProcessingIndicator();
            showToast("Error", "File processing timed out. Please try a smaller file or check the file format.", "error");
            rosterFile.value = '';
        }, 30000); // 30 second timeout
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                console.log("File read complete, processing data...");
                
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { 
                    type: 'array',
                    cellStyles: false, // Disable styles to speed up processing
                    cellFormulas: false, // Disable formulas to speed up processing
                    sheetStubs: false // Don't include empty cells
                });
                
                // Get the first sheet
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) {
                    throw new Error("No worksheets found in the file");
                }
                
                const worksheet = workbook.Sheets[firstSheetName];
                if (!worksheet) {
                    throw new Error("Unable to read the worksheet");
                }
                
                console.log("Converting sheet to JSON...");
                
                // Convert to JSON with better options
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1,
                    defval: '', // Default value for empty cells
                    blankrows: false // Skip blank rows
                });
                
                console.log("JSON conversion complete, rows found:", jsonData.length);
                
                // Clear timeout since processing succeeded
                clearTimeout(timeoutId);
                
                // Process data to identify headers and build roster entries
                processRosterData(jsonData);
                
                // Hide processing indicator
                hideProcessingIndicator();
                
                // Show preview
                filePreview.classList.remove('d-none');
                
                console.log("File processing complete");
                
            } catch (error) {
                console.error("Error processing file:", error);
                clearTimeout(timeoutId);
                hideProcessingIndicator();
                
                let errorMessage = "Failed to process file: " + error.message;
                
                // Provide more specific error messages
                if (error.message.includes('zip')) {
                    errorMessage = "The file appears to be corrupted or is not a valid Excel file. Please try saving it again.";
                } else if (error.message.includes('password')) {
                    errorMessage = "This file appears to be password protected. Please remove the password and try again.";
                } else if (error.message.includes('format')) {
                    errorMessage = "Unsupported file format. Please save as .xlsx, .xls, or .csv format.";
                }
                
                showToast("Error", errorMessage, "error");
                
                // Clear the file input
                rosterFile.value = '';
                filePreview.classList.add('d-none');
                rosterData = [];
            }
        };
        
        reader.onerror = function(error) {
            console.error("FileReader error:", error);
            clearTimeout(timeoutId);
            hideProcessingIndicator();
            showToast("Error", "Failed to read the file. Please try again.", "error");
            rosterFile.value = '';
        };
        
        reader.onabort = function() {
            console.log("File reading was aborted");
            clearTimeout(timeoutId);
            hideProcessingIndicator();
        };
        
        // Start reading the file
        console.log("Starting to read file...");
        reader.readAsArrayBuffer(file);
    }
    
    function showProcessingIndicator() {
        // Show processing message in preview area
        previewContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Processing...</span>
                </div>
                <h6>Processing your roster file...</h6>
                <p class="text-muted mb-0">This may take a moment for larger files.</p>
                <button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="cancelFileProcessing()">
                    Cancel
                </button>
            </div>
        `;
        filePreview.classList.remove('d-none');
        
        // Disable the file input while processing
        rosterFile.disabled = true;
        refreshPreviewBtn.disabled = true;
    }
    
    function hideProcessingIndicator() {
        // Re-enable the file input
        rosterFile.disabled = false;
        refreshPreviewBtn.disabled = false;
    }
    
    // Global function to cancel file processing
    window.cancelFileProcessing = function() {
        console.log("File processing cancelled by user");
        hideProcessingIndicator();
        filePreview.classList.add('d-none');
        rosterFile.value = '';
        rosterData = [];
        showToast("Info", "File processing cancelled", "info");
    };
    
    function processRosterData(jsonData) {
        console.log("Processing roster data, rows:", jsonData.length);
        
        if (!jsonData || jsonData.length < 1) {
            throw new Error("File appears to be empty or has no data");
        }
        
        if (jsonData.length < 2) {
            throw new Error("File must contain at least a header row and one data row");
        }
        
        // Get headers from first row
        const headers = jsonData[0];
        if (!headers || headers.length === 0) {
            throw new Error("No column headers found in the first row");
        }
        
        console.log("Headers found:", headers);
        
        // Identify relevant columns - updated to include Images field
        const lastNameIndex = findColumnIndex(headers, ["last name", "last", "lastname", "surname", "family name", "name"]);
        const firstNameIndex = findColumnIndex(headers, ["first name", "first", "firstname", "name", "given name", "subject id"]);
        const teacherIndex = findColumnIndex(headers, ["teacher", "special", "instructor"]);
        const groupIndex = findColumnIndex(headers, ["group", "sport/team", "team", "sport"]);
        const emailIndex = findColumnIndex(headers, ["email", "e-mail", "email address"]);
        const phoneIndex = findColumnIndex(headers, ["phone", "telephone", "phone number", "cell"]);
        const imagesIndex = findColumnIndex(headers, ["images", "image", "image numbers", "image number", "photo numbers", "photo number"]);
        
        console.log("Column mapping:", {
            lastName: lastNameIndex,
            firstName: firstNameIndex,
            teacher: teacherIndex,
            group: groupIndex,
            email: emailIndex,
            phone: phoneIndex,
            images: imagesIndex
        });
        
        // Process data rows with progress tracking
        rosterData = [];
        const totalRows = jsonData.length - 1; // Exclude header row
        let processedRows = 0;
        
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Skip completely empty rows
            if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }
            
            try {
                // Map fields according to requirements:
                // "Last Name" column as "Name", "First Name" column as "Subject ID", 
                // "Teacher" column as "Special", "Group" column as "Sport/Team"
                // "Images" column as "Image Numbers"
                const entry = {
                    id: generateUniqueId(),
                    lastName: lastNameIndex >= 0 ? String(row[lastNameIndex] || "").trim() : "",
                    firstName: firstNameIndex >= 0 ? String(row[firstNameIndex] || "").trim() : "", 
                    teacher: teacherIndex >= 0 ? String(row[teacherIndex] || "").trim() : "",
                    group: groupIndex >= 0 ? String(row[groupIndex] || "").trim() : "",
                    email: emailIndex >= 0 ? String(row[emailIndex] || "").trim() : "",
                    phone: phoneIndex >= 0 ? String(row[phoneIndex] || "").trim() : "",
                    imageNumbers: imagesIndex >= 0 ? String(row[imagesIndex] || "").trim() : "",
                    notes: ""
                };
                
                rosterData.push(entry);
                processedRows++;
                
                // Update progress every 100 rows for large files
                if (processedRows % 100 === 0) {
                    console.log(`Processed ${processedRows}/${totalRows} rows`);
                }
                
            } catch (rowError) {
                console.warn(`Error processing row ${i}:`, rowError, "Row data:", row);
                // Continue processing other rows instead of failing completely
            }
        }
        
        console.log(`Processing complete. ${processedRows} rows processed, ${rosterData.length} entries created`);
        
        if (rosterData.length === 0) {
            throw new Error("No valid data rows found. Please check that your file contains athlete information.");
        }
        
        // Create preview table
        createPreviewTable(headers, jsonData, { 
            lastNameIndex, 
            firstNameIndex, 
            teacherIndex, 
            groupIndex, 
            emailIndex, 
            phoneIndex,
            imagesIndex
        });
    }
    
    function findColumnIndex(headers, possibleNames) {
        const normalizedHeaders = headers.map(h => String(h || "").toLowerCase().trim());
        
        for (const name of possibleNames) {
            const index = normalizedHeaders.indexOf(name);
            if (index !== -1) return index;
            
            // Try partial match
            for (let i = 0; i < normalizedHeaders.length; i++) {
                if (normalizedHeaders[i].includes(name)) return i;
            }
        }
        
        return -1;
    }
    
    function createPreviewTable(headers, jsonData, columnIndices) {
        console.log("Creating preview table");
        
        // Create table
        let html = `
            <table class="preview-table">
                <thead>
                    <tr>
        `;
        
        // Add headers
        for (let i = 0; i < headers.length; i++) {
            const isLastName = i === columnIndices.lastNameIndex;
            const isFirstName = i === columnIndices.firstNameIndex;
            const isTeacher = i === columnIndices.teacherIndex;
            const isGroup = i === columnIndices.groupIndex;
            const isEmail = i === columnIndices.emailIndex;
            const isPhone = i === columnIndices.phoneIndex;
            const isImages = i === columnIndices.imagesIndex;
            
            // Show which fields will be mapped
            let headerText = headers[i] || '';
            if (isLastName) headerText += " (Name)";
            if (isFirstName) headerText += " (Subject ID)";
            if (isTeacher) headerText += " (Special)";
            if (isGroup) headerText += " (Sport/Team)";
            if (isImages) headerText += " (Image Numbers)";
            
            const headerClass = (isLastName || isFirstName || isTeacher || isGroup || isEmail || isPhone || isImages) ? 'text-primary' : '';
            
            html += `<th class="${headerClass}">${headerText}</th>`;
        }
        
        html += `
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add rows (max 5 for preview)
        const rowCount = Math.min(jsonData.length, 6);
        for (let i = 1; i < rowCount; i++) {
            const row = jsonData[i];
            html += '<tr>';
            
            for (let j = 0; j < headers.length; j++) {
                const isLastName = j === columnIndices.lastNameIndex;
                const isFirstName = j === columnIndices.firstNameIndex;
                const isTeacher = j === columnIndices.teacherIndex;
                const isGroup = j === columnIndices.groupIndex;
                const isEmail = j === columnIndices.emailIndex;
                const isPhone = j === columnIndices.phoneIndex;
                const isImages = j === columnIndices.imagesIndex;
                
                const cellClass = (isLastName || isFirstName || isTeacher || isGroup || isEmail || isPhone || isImages) ? 'text-primary' : '';
                
                html += `<td class="${cellClass}">${row[j] || ''}</td>`;
            }
            
            html += '</tr>';
        }
        
        html += `
                </tbody>
            </table>
        `;
        
        if (jsonData.length > 6) {
            html += `<p class="text-muted">...and ${jsonData.length - 6} more rows</p>`;
        }
        
        // Update preview
        previewContainer.innerHTML = html;
        
        // Count only valid athletes (those with last names) for the stats
        const validAthleteCount = countValidAthletes(rosterData);
        const totalEntries = rosterData.length;
        const blankEntries = totalEntries - validAthleteCount;
        
        let statsText = `Total athletes: ${validAthleteCount}`;
        if (blankEntries > 0) {
            statsText += ` (${blankEntries} entries without names will be included as placeholders)`;
        }
        
        previewStats.textContent = statsText;
        
        console.log("Preview table created successfully");
    }
}

// Set up event listeners for job actions
function setupJobActions() {
    console.log("Setting up job actions");
    
    // Remove any existing listeners to prevent duplicates
    document.removeEventListener('click', handleJobActions);
    
    // Add the event listener
    document.addEventListener('click', handleJobActions);
}

// Handle job action clicks - separated into its own function for better management
function handleJobActions(event) {
    // View job
    if (event.target.closest('.view-job-btn')) {
        event.preventDefault();
        event.stopPropagation();
        
        const btn = event.target.closest('.view-job-btn');
        const jobId = btn.dataset.jobId;
        console.log("View job button clicked for jobId:", jobId);
        
        if (!jobId) {
            console.error("No job ID found on view button");
            showToast("Error", "Unable to identify the job to view.", "error");
            return;
        }
        
        // Disable button temporarily to prevent double-clicks
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        
        viewJob(jobId);
        
        // Re-enable button after a short delay
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-eye"></i> View';
        }, 2000);
        
        return;
    }
    
    // Delete job
    if (event.target.closest('.delete-job-btn')) {
        event.preventDefault();
        event.stopPropagation();
        
        const btn = event.target.closest('.delete-job-btn');
        const jobId = btn.dataset.jobId;
        console.log("Delete job button clicked for jobId:", jobId);
        
        if (!jobId) {
            console.error("No job ID found on delete button");
            showToast("Error", "Unable to identify the job to delete.", "error");
            return;
        }
        
        if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
            deleteJob(jobId);
        }
        
        return;
    }
    
    // Toggle archive status from list view
    if (event.target.closest('.toggle-archive-btn')) {
        event.preventDefault();
        event.stopPropagation();
        
        const btn = event.target.closest('.toggle-archive-btn');
        const jobId = btn.dataset.jobId;
        const isArchived = btn.dataset.isArchived === 'true';
        console.log("Toggle archive button clicked for jobId:", jobId, "isArchived:", isArchived);
        
        if (!jobId) {
            console.error("No job ID found on toggle archive button");
            showToast("Error", "Unable to identify the job to archive/activate.", "error");
            return;
        }
        
        toggleJobArchiveStatus(jobId, !isArchived);
        
        return;
    }
}

// Setup Roster Entry Form
function setupRosterEntryForm() {
    console.log("Setting up roster entry form");
    
    const saveRosterEntryBtn = document.getElementById('saveRosterEntryBtn');
    if (!saveRosterEntryBtn) {
        console.log("Save roster entry button not found");
        return;
    }
    
    saveRosterEntryBtn.addEventListener('click', function() {
        // Get form values
        const entryId = document.getElementById('entryId').value;
        const lastName = document.getElementById('lastName').value.trim();
        const firstName = document.getElementById('firstName').value.trim();
        const teacher = document.getElementById('teacher').value.trim();
        const group = document.getElementById('group').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const imageNumbers = document.getElementById('imageNumbers').value.trim();
        const notes = document.getElementById('notes').value.trim();
        
        // Create entry object
        const entry = {
            id: entryId || generateUniqueId(),
            lastName,
            firstName,
            teacher,
            group,
            email,
            phone,
            imageNumbers,
            notes
        };
        
        // Check if adding new or editing existing entry
        if (entryId) {
            // Edit existing entry
            const index = rosterData.findIndex(item => item.id === entryId);
            if (index !== -1) {
                rosterData[index] = entry;
            }
        } else {
            // Add new entry
            rosterData.push(entry);
        }
        
        // Save to Firestore
        updateJobRoster(currentJobID, rosterData);
        
        // Close modal
        const rosterEntryModal = document.getElementById('rosterEntryModal');
        if (rosterEntryModal) {
            const bsRosterEntryModal = bootstrap.Modal.getInstance(rosterEntryModal);
            if (bsRosterEntryModal) {
                bsRosterEntryModal.hide();
            }
        }
    });
    
    // Attach event handlers to edit and delete buttons in the roster table
    document.addEventListener('click', function(event) {
        // Edit roster entry
        if (event.target.closest('.edit-roster-entry-btn')) {
            const entryId = event.target.closest('.edit-roster-entry-btn').dataset.entryId;
            editRosterEntry(entryId);
        }
        
        // Delete roster entry
        if (event.target.closest('.delete-roster-entry-btn')) {
            const entryId = event.target.closest('.delete-roster-entry-btn').dataset.entryId;
            if (confirm('Are you sure you want to delete this athlete? This action cannot be undone.')) {
                deleteRosterEntry(entryId);
            }
        }
    });
}

// View job details
function viewJob(jobId, highlightPlayerId = null) {
    console.log("ViewJob called with jobId:", jobId);
    
    const viewJobModal = document.getElementById('viewJobModal');
    if (!viewJobModal) {
        console.error("View job modal not found");
        showToast("Error", "Unable to open job details. Please refresh the page.", "error");
        return;
    }
    
    let bsViewJobModal = bootstrap.Modal.getInstance(viewJobModal);
    if (!bsViewJobModal) {
        bsViewJobModal = new bootstrap.Modal(viewJobModal, {
            backdrop: true,
            keyboard: true
        });
    }
    
    const jobDetails = document.getElementById('jobDetails');
    const viewJobTitle = document.getElementById('viewJobTitle');
    const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
    const archiveButtonText = document.getElementById('archiveButtonText');
    
    if (!jobDetails) {
        console.error("Job details element not found");
        showToast("Error", "Unable to load job details. Please refresh the page.", "error");
        return;
    }
    
    if (!viewJobTitle) {
        console.error("View job title element not found");
        showToast("Error", "Unable to load job title. Please refresh the page.", "error");
        return;
    }
    
    if (!toggleArchiveBtn) {
        console.error("Toggle archive button not found");
        showToast("Error", "Unable to load archive controls. Please refresh the page.", "error");
        return;
    }
    
    if (!archiveButtonText) {
        console.error("Archive button text element not found");
        showToast("Error", "Unable to load archive button text. Please refresh the page.", "error");
        return;
    }
    
    // Show loading state
    jobDetails.innerHTML = `
        <div class="col-12 text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading job details...</p>
        </div>
    `;
    
    // Store current job ID
    currentJobID = jobId;
    
    console.log("Fetching job from Firestore with ID:", jobId);
    
    // Fetch job data
    db.collection(SPORTS_JOBS_COLLECTION).doc(jobId).get()
        .then((doc) => {
            console.log("Firestore query completed. Document exists:", doc.exists);
            
            if (!doc.exists) {
                console.error("Job not found in Firestore");
                jobDetails.innerHTML = `
                    <div class="col-12 text-center py-3">
                        <div class="alert alert-danger">Job not found</div>
                    </div>
                `;
                showToast("Error", "Job not found in database.", "error");
                return;
            }
            
            const job = doc.data();
            job.id = doc.id;
            
            console.log("Job data loaded:", {
                id: job.id,
                schoolName: job.schoolName,
                seasonType: job.seasonType,
                isArchived: job.isArchived,
                rosterCount: job.roster ? job.roster.length : 0
            });
            
            // Store roster and groups data
            rosterData = job.roster || [];
            groupsData = job.groupImages || [];
            
            // Update modal title with season/type and optional sport
            const seasonTypeDisplay = job.seasonType || job.sportName || '';
            const sportDisplay = job.sportName && job.seasonType ? ` - ${job.sportName}` : '';
            viewJobTitle.textContent = `${job.schoolName} - ${seasonTypeDisplay}${sportDisplay}`;
            
            // Format date
            const date = new Date(job.shootDate.toDate ? job.shootDate.toDate() : job.shootDate);
            const formattedDate = date.toLocaleDateString();
            
            // Update the archive button text based on archive status
            if (job.isArchived) {
                toggleArchiveBtn.classList.remove('btn-outline-success');
                toggleArchiveBtn.classList.add('btn-outline-primary');
                archiveButtonText.textContent = 'Mark as Active';
            } else {
                toggleArchiveBtn.classList.remove('btn-outline-primary');
                toggleArchiveBtn.classList.add('btn-outline-success');
                archiveButtonText.textContent = 'Mark as Completed';
            }
            
            // Set up toggle archive button handler
            toggleArchiveBtn.onclick = function() {
                console.log("Archive button clicked, toggling status for job:", jobId);
                toggleJobArchiveStatus(jobId, !job.isArchived);
            };
            
            // Calculate valid athlete count
            const validAthleteCount = countValidAthletes(rosterData);
            const totalRosterEntries = rosterData.length;
            const blankCount = totalRosterEntries - validAthleteCount;
            const photographedCount = countPhotographedAthletes(rosterData);
            
            // Render job details
            jobDetails.innerHTML = `
                <div class="col-md-6">
                    <h4>${job.schoolName}</h4>
                    <h5 class="text-primary">${seasonTypeDisplay}${sportDisplay}</h5>
                    <p class="text-muted">
                        <strong>Date:</strong> ${formattedDate}
                        ${job.location ? `<br><strong>Location:</strong> ${job.location}` : ''}
                        ${job.photographer ? `<br><strong>Photographer:</strong> ${job.photographer}` : ''}
                    </p>
                </div>
                <div class="col-md-6">
                    <div class="d-flex justify-content-end mb-3">
                        <button type="button" id="topToggleArchiveBtn" class="btn ${job.isArchived ? 'btn-outline-primary' : 'btn-outline-success'}">
                            <i class="bi ${job.isArchived ? 'bi-arrow-counterclockwise' : 'bi-check-circle'}"></i> 
                            <span>${job.isArchived ? 'Mark as Active' : 'Mark as Completed'}</span>
                        </button>
                    </div>
                    <div class="card">
                        <div class="card-body p-3">
                            <div class="row">
                                <div class="col-4 border-end">
                                    <div class="text-center">
                                        <h3>${validAthleteCount}</h3>
                                        <p class="mb-0 text-muted">Athletes</p>
                                        ${blankCount > 0 ? `<small class="text-warning">${blankCount} blank</small>` : ''}
                                    </div>
                                </div>
                                <div class="col-4 border-end">
                                    <div class="text-center">
                                        <h3>${photographedCount}</h3>
                                        <p class="mb-0 text-muted">Photographed</p>
                                        ${validAthleteCount > 0 ? `<small class="text-info">${Math.round((photographedCount / validAthleteCount) * 100)}%</small>` : ''}
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="text-center">
                                        <h3>${groupsData.length}</h3>
                                        <p class="mb-0 text-muted">Groups</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${job.additionalNotes ? `
                        <div class="mt-3">
                            <h6>Notes:</h6>
                            <p class="text-muted">${job.additionalNotes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Set up top archive button handler
            const topToggleArchiveBtn = document.getElementById('topToggleArchiveBtn');
            if (topToggleArchiveBtn) {
                topToggleArchiveBtn.addEventListener('click', function() {
                    console.log("Top archive button clicked, toggling status for job:", jobId);
                    toggleJobArchiveStatus(jobId, !job.isArchived);
                });
            }
            
            // Render roster
            renderRoster(rosterData);
            
            // Render groups
            renderGroups(groupsData);
            
            // Render job-specific stats
            renderJobStats(job);
            
            console.log("About to show modal");
            
            // Show modal
            bsViewJobModal.show();
            
            console.log("Modal show() called");
            
            // If we need to highlight a player, wait for modal to be shown
            if (highlightPlayerId) {
                viewJobModal.addEventListener('shown.bs.modal', function onModalShown() {
                    // Find and highlight the player row
                    highlightAndScrollToPlayer(highlightPlayerId);
                    // Remove this specific listener
                    viewJobModal.removeEventListener('shown.bs.modal', onModalShown);
                }, { once: true });
            }
            
            // Add event listener for modal hidden event
            viewJobModal.addEventListener('hidden.bs.modal', function onModalHidden() {
                // Ensure all backdrops are removed
                cleanupModalBackdrops();
                // Remove this specific event listener to avoid duplicate bindings
                viewJobModal.removeEventListener('hidden.bs.modal', onModalHidden);
            }, { once: true });
        })
        .catch((error) => {
            console.error("Error fetching job from Firestore:", error);
            jobDetails.innerHTML = `
                <div class="col-12 text-center py-3">
                    <div class="alert alert-danger">Error fetching job: ${error.message}</div>
                </div>
            `;
            showToast("Error", "Failed to load job details: " + error.message, "error");
        });
}

// Edit roster entry
function editRosterEntry(entryId) {
    console.log("Editing roster entry:", entryId);
    
    // Find entry in roster data
    const entry = rosterData.find(item => item.id === entryId);
    if (!entry) {
        console.error("Roster entry not found");
        return;
    }
    
    // Set form values
    document.getElementById('entryId').value = entry.id;
    document.getElementById('lastName').value = entry.lastName || '';
    document.getElementById('firstName').value = entry.firstName || '';
    document.getElementById('teacher').value = entry.teacher || '';
    document.getElementById('group').value = entry.group || '';
    document.getElementById('email').value = entry.email || '';
    document.getElementById('phone').value = entry.phone || '';
    document.getElementById('imageNumbers').value = entry.imageNumbers || '';
    document.getElementById('notes').value = entry.notes || '';
    
    // Update modal title
    const rosterEntryModalTitle = document.getElementById('rosterEntryModalTitle');
    if (rosterEntryModalTitle) {
        rosterEntryModalTitle.textContent = 'Edit Athlete';
    }
    
    // Show modal
    const rosterEntryModal = document.getElementById('rosterEntryModal');
    if (rosterEntryModal) {
        let bsRosterEntryModal = bootstrap.Modal.getInstance(rosterEntryModal);
        if (!bsRosterEntryModal) {
            bsRosterEntryModal = new bootstrap.Modal(rosterEntryModal);
        }
        bsRosterEntryModal.show();
    }
}

// Delete roster entry
function deleteRosterEntry(entryId) {
    console.log("Deleting roster entry:", entryId);
    
    // Filter out the entry from roster data
    rosterData = rosterData.filter(item => item.id !== entryId);
    
    // Save to Firestore
    updateJobRoster(currentJobID, rosterData);
    
    // Re-render roster
    renderRoster(rosterData);
}

// Update job roster in Firestore
function updateJobRoster(jobId, roster) {
    if (!jobId) {
        console.error("No job ID provided");
        return Promise.reject(new Error("No job ID provided"));
    }
    
    return db.collection(SPORTS_JOBS_COLLECTION).doc(jobId).update({
        roster: roster,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("Roster updated successfully");
        
        // Re-render roster
        renderRoster(roster);
        
        // Show success message
        showToast("Success", "Roster updated successfully");
        
        // Update the job in allJobs for search functionality
        const jobIndex = allJobs.findIndex(job => job.id === jobId);
        if (jobIndex !== -1) {
            allJobs[jobIndex].roster = roster;
            
            // If search is active and searching for players, refresh the search results
            if (isSearchActive && currentSearchType === 'players') {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.value.trim()) {
                    searchPlayers(searchInput.value.trim());
                }
            }
        }
        
        // If the sports stats tab is visible on the main screen, refresh it
        const sportsStatsTab = document.getElementById('sports-stats-tab');
        if (sportsStatsTab && sportsStatsTab.classList.contains('active')) {
            renderSportsStats(null);
        }
        
        // If the job stats tab is visible in the modal, refresh it
        const jobStatsTab = document.getElementById('job-stats-tab');
        if (jobStatsTab && jobStatsTab.classList.contains('active')) {
            const job = allJobs.find(j => j.id === jobId);
            if (job) {
                job.roster = roster; // Update the job's roster
                renderJobStats(job);
            }
        }
        
        return Promise.resolve();
    })
    .catch((error) => {
        console.error("Error updating roster:", error);
        showToast("Error", "Failed to update roster: " + error.message, "error");
        return Promise.reject(error);
    });
}

// Firebase configuration - Replace with your own config
const firebaseConfig = {
  apiKey: "AIzaSyDS0mMpgPEFoVZAQ0HUBMXG4_OzzH2UHL8",
  authDomain: "nfc-scanner-348a4.firebaseapp.com",
  projectId: "nfc-scanner-348a4",
  storageBucket: "nfc-scanner-348a4.firebasestorage.app",
  messagingSenderId: "700201321131",
  appId: "1:700201321131:web:e16a6c744d6fa6ce5bedee",
  measurementId: "G-D57ZVWTJVV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// Current user data
let currentUser = null;
let currentOrganizationID = "";

// Current job data
let currentJobID = "";
let rosterData = [];
let groupsData = [];

// Add these global variables for search and sort
let allJobs = []; // Store all jobs for client-side filtering
let currentSearchType = 'jobs'; // Default search type: 'jobs' or 'players'
let isSearchActive = false; // Flag to track if search is active
let currentFolderView = { level: 'root', school: null, year: null }; // Track current folder view

// Collection names
const SPORTS_JOBS_COLLECTION = "sportsJobs";
const DROPDOWN_DATA_COLLECTION = "dropdownData";

// DOM Elements 
let loginSection, appSection, loginForm, loginButton, loginSpinner;
let loginErrorMessage, togglePasswordBtn, passwordInput, emailInput;
let forgotPasswordLink, rememberMeCheckbox, resetPasswordModal;
let resetEmailInput, sendResetLinkBtn, resetSpinner;
let resetErrorMessage, resetSuccessMessage, logoutBtn, userEmail;

// Initialize UI components only after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    
    // Get DOM elements
    loginSection = document.getElementById('loginSection');
    appSection = document.getElementById('appSection');
    loginForm = document.getElementById('loginForm');
    loginButton = document.getElementById('loginButton');
    loginSpinner = document.getElementById('loginSpinner');
    loginErrorMessage = document.getElementById('loginErrorMessage');
    togglePasswordBtn = document.getElementById('togglePassword');
    passwordInput = document.getElementById('password');
    emailInput = document.getElementById('email');
    forgotPasswordLink = document.getElementById('forgotPassword');
    rememberMeCheckbox = document.getElementById('rememberMe');
    resetEmailInput = document.getElementById('resetEmailInput');
    sendResetLinkBtn = document.getElementById('sendResetLinkBtn');
    resetSpinner = document.getElementById('resetSpinner');
    resetErrorMessage = document.getElementById('resetErrorMessage');
    resetSuccessMessage = document.getElementById('resetSuccessMessage');
    logoutBtn = document.getElementById('logoutBtn');
    userEmail = document.getElementById('userEmail');
    
    // Initialize Bootstrap components
    if (document.getElementById('resetPasswordModal')) {
        resetPasswordModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    }
    
    // Initialize components
    initializeComponents();
    
    // Check auth state
    checkAuthState();
    
    // Ensure event listeners are set up immediately
    console.log("Setting up initial event listeners");
    ensureEventListenersActive();
});

// Function to ensure all event listeners are properly active
function ensureEventListenersActive() {
    console.log("Ensuring all event listeners are active");
    
    // Re-setup job actions
    setupJobActions();
    
    // Also ensure search functionality works
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        setupSearchAndSort();
    }
    
    // Set up a periodic check to ensure buttons remain clickable
    // This helps handle cases where the DOM changes but listeners get lost
    if (!window.eventListenerInterval) {
        window.eventListenerInterval = setInterval(() => {
            // Check if we have job cards but no working event listeners
            const viewButtons = document.querySelectorAll('.view-job-btn');
            if (viewButtons.length > 0) {
                // Test if the first button has our event listener by checking if it has the right data
                const firstButton = viewButtons[0];
                if (firstButton && !firstButton.dataset.listenerAttached) {
                    console.log("Detected buttons without event listeners, re-attaching");
                    setupJobActions();
                    
                    // Mark buttons as having listeners attached
                    viewButtons.forEach(btn => {
                        btn.dataset.listenerAttached = 'true';
                    });
                }
            }
        }, 5000); // Check every 5 seconds
    }
}

// Helper function to count valid athletes (those with last names)
function countValidAthletes(roster) {
    if (!roster || !Array.isArray(roster)) return 0;
    return roster.filter(athlete => athlete.lastName && athlete.lastName.trim() !== '').length;
}

// Helper function to count photographed athletes (those with image numbers)
function countPhotographedAthletes(roster) {
    if (!roster || !Array.isArray(roster)) return 0;
    return roster.filter(athlete => athlete.imageNumbers && athlete.imageNumbers.trim() !== '').length;
}

// Show toast notification
function showToast(title, message, type = "success") {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Set toast background color based on type
    if (type === "success") {
        toast.classList.add('bg-success', 'text-white');
    } else if (type === "error") {
        toast.classList.add('bg-danger', 'text-white');
    } else if (type === "warning") {
        toast.classList.add('bg-warning', 'text-dark');
    } else if (type === "info") {
        toast.classList.add('bg-info', 'text-dark');
    }
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong>: ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Create Bootstrap toast instance with 5 second delay
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000  // 5 seconds
    });
    
    // Show the toast
    bsToast.show();
    
    // Event listener for when toast is hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Generate unique ID for new entries
function generateUniqueId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Check authentication state
function checkAuthState() {
    console.log("Checking auth state");
    auth.onAuthStateChanged(function(user) {
        console.log("Auth state changed:", user ? "Logged in" : "Logged out");
        
        if (user) {
            // User is signed in
            currentUser = user;
            
            // Update UI with user info
            if (userEmail) {
                userEmail.textContent = user.email;
            }
            
            // Show app section, hide login section
            if (loginSection && appSection) {
                console.log("Showing app section");
                loginSection.classList.add('d-none');
                appSection.classList.remove('d-none');
            }
            
            // Fetch user's organization ID from Firestore
            fetchUserOrganizationID(user.uid);
        } else {
            // User is not signed in
            currentUser = null;
            currentOrganizationID = "";
            
            // Show login section, hide app section
            if (loginSection && appSection) {
                console.log("Showing login section");
                loginSection.classList.remove('d-none');
                appSection.classList.add('d-none');
            }
            
            // Reset login form if it exists
            if (loginForm) {
                loginForm.reset();
            }
            
            // Reset loading state
            if (loginButton && loginSpinner) {
                loginButton.disabled = false;
                loginSpinner.classList.add('d-none');
            }
        }
    });
}

// Initialize UI components
function initializeComponents() {
    console.log("Initializing components");
    
    // Initialize date picker
    if (document.getElementById('shootDate')) {
        flatpickr("#shootDate", {
            enableTime: false,
            dateFormat: "Y-m-d",
            defaultDate: new Date()
        });
    }
    
    // Setup event listeners
    setupLoginForm();
    setupPasswordReset();
    setupLogout();
    setupCreateJobForm();
    setupRosterFileUpload();
    setupJobActions();
    setupRosterEntryForm();
    setupGroupForm();
    setupExportFunctions();
    setupModalBackdropFix();
    setupStatusTabs();
    setupSportsStats();
    
    // Load school names for dropdown
    loadSchoolNames();
    
    // Setup search and sort controls
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        console.log("Setting up search and sort");
        setupSearchAndSort();
    } else {
        console.log("Search input not found, skipping search setup");
    }
}

// Setup login form
function setupLoginForm() {
    if (!loginForm) {
        console.log("Login form not found");
        return;
    }
    
    console.log("Setting up login form");
    
    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        console.log("Login form submitted");
        
        // Show loading state
        loginButton.disabled = true;
        loginSpinner.classList.remove('d-none');
        loginErrorMessage.style.display = 'none';
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const persistence = rememberMeCheckbox.checked ? 
            firebase.auth.Auth.Persistence.LOCAL : 
            firebase.auth.Auth.Persistence.SESSION;
        
        console.log("Setting persistence and signing in");
        
        // Set persistence first
        auth.setPersistence(persistence)
            .then(() => {
                // Sign in with email and password
                return auth.signInWithEmailAndPassword(email, password);
            })
            .then(() => {
                // Authentication successful
                // The onAuthStateChanged handler will update the UI
                console.log("Authentication successful");
            })
            .catch((error) => {
                // Display error message
                console.error("Authentication error:", error);
                loginErrorMessage.textContent = error.message;
                loginErrorMessage.style.display = 'block';
                
                // Reset loading state
                loginButton.disabled = false;
                loginSpinner.classList.add('d-none');
            });
    });
    
    // Toggle password visibility
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('bi-eye');
                icon.classList.toggle('bi-eye-slash');
            }
        });
    }
}

// Setup status tabs (Active/Completed/Stats)
function setupStatusTabs() {
    // Listen for tab changes to load content accordingly
    const activeJobsTab = document.getElementById('active-jobs-tab');
    const completedJobsTab = document.getElementById('completed-jobs-tab');
    const sportsStatsTab = document.getElementById('sports-stats-tab');
    
    if (activeJobsTab && completedJobsTab) {
        activeJobsTab.addEventListener('shown.bs.tab', () => {
            loadJobs(false);
        });
        
        completedJobsTab.addEventListener('shown.bs.tab', () => {
            loadArchivedJobs();
        });
    }
    
    if (sportsStatsTab) {
        sportsStatsTab.addEventListener('shown.bs.tab', () => {
            // Load sports stats when tab is shown
            renderSportsStats(null);
        });
    }
}

// Setup password reset
function setupPasswordReset() {
    if (!forgotPasswordLink || !sendResetLinkBtn) {
        console.log("Password reset elements not found");
        return;
    }
    
    console.log("Setting up password reset");
    
    forgotPasswordLink.addEventListener('click', function() {
        // Pre-fill the email if it's entered in the login form
        resetEmailInput.value = emailInput.value;
        
        // Clear previous messages
        resetErrorMessage.classList.add('d-none');
        resetSuccessMessage.classList.add('d-none');
        
        // Show the modal
        resetPasswordModal.show();
    });
    
    sendResetLinkBtn.addEventListener('click', function() {
        const email = resetEmailInput.value.trim();
        
        if (!email) {
            resetErrorMessage.textContent = 'Please enter your email address.';
            resetErrorMessage.classList.remove('d-none');
            resetSuccessMessage.classList.add('d-none');
            return;
        }
        
        // Show loading state
        sendResetLinkBtn.disabled = true;
        resetSpinner.classList.remove('d-none');
        resetErrorMessage.classList.add('d-none');
        resetSuccessMessage.classList.add('d-none');
        
        // Send password reset email
        auth.sendPasswordResetEmail(email)
            .then(() => {
                // Success
                resetSuccessMessage.textContent = 'Password reset email sent. Check your inbox.';
                resetSuccessMessage.classList.remove('d-none');
                
                // Hide the modal after 3 seconds
                setTimeout(() => {
                    resetPasswordModal.hide();
                }, 3000);
            })
            .catch((error) => {
                // Display error message
                resetErrorMessage.textContent = error.message;
                resetErrorMessage.classList.remove('d-none');
            })
            .finally(() => {
                // Reset loading state
                sendResetLinkBtn.disabled = false;
                resetSpinner.classList.add('d-none');
            });
    });
}

// Setup logout
function setupLogout() {
    if (!logoutBtn) {
        console.log("Logout button not found");
        return;
    }
    
    console.log("Setting up logout");
    
    logoutBtn.addEventListener('click', function() {
        auth.signOut().catch(error => {
            console.error("Error signing out:", error);
            showToast("Error", "Failed to sign out: " + error.message, "error");
        });
    });
}

// Fetch user's organization ID
function fetchUserOrganizationID(userId) {
    console.log("Fetching organization ID for user:", userId);
    
    db.collection("users").doc(userId).get()
        .then((doc) => {
            if (doc.exists) {
                currentOrganizationID = doc.data().organizationID || "";
                console.log("Organization ID:", currentOrganizationID);
                
                // Load school names for the dropdown
                loadSchoolNames();
                
                // Update existing jobs with isArchived field
                updateExistingJobsWithArchiveField();
                
                // Now load jobs
                loadJobs(false);
                
                // Set up real-time listeners for jobs
                setupRealTimeListeners();
            } else {
                console.warn("User profile not found");
                showToast("Warning", "User profile not found. Contact your administrator.", "warning");
            }
        })
        .catch((error) => {
            console.error("Error fetching user data:", error);
            showToast("Error", "Error fetching user data: " + error.message, "error");
        });
}

// Set up real-time listeners for job updates from other devices
function setupRealTimeListeners() {
    if (!currentOrganizationID) {
        console.error("No organization ID available");
        return;
    }
    
    console.log("Setting up real-time listeners for organization:", currentOrganizationID);
    
    // Unsubscribe from any existing listeners
    if (window.jobsListener) {
        window.jobsListener();
    }
    
    // Set up a listener for changes to jobs collection
    window.jobsListener = db.collection(SPORTS_JOBS_COLLECTION)
        .where("organizationID", "==", currentOrganizationID)
        .onSnapshot((snapshot) => {
            let needsRefresh = false;
            
            snapshot.docChanges().forEach((change) => {
                const jobData = change.doc.data();
                jobData.id = change.doc.id;
                
                if (change.type === "added") {
                    // Skip if we already have this job (to avoid duplicates)
                    if (!allJobs.some(j => j.id === jobData.id)) {
                        allJobs.push(jobData);
                        needsRefresh = true;
                    }
                }
                else if (change.type === "modified") {
                    // Update the job in our local array
                    const index = allJobs.findIndex(j => j.id === jobData.id);
                    if (index !== -1) {
                        allJobs[index] = jobData;
                        needsRefresh = true;
                        
                        // If this is the currently open job, refresh it
                        if (currentJobID === jobData.id) {
                            // Update the current roster and groups data
                            rosterData = jobData.roster || [];
                            groupsData = jobData.groupImages || [];
                            
                            // Re-render if the job modal is open
                            const viewJobModal = document.getElementById('viewJobModal');
                            if (viewJobModal && viewJobModal.classList.contains('show')) {
                                // Re-render roster and groups
                                renderRoster(rosterData);
                                renderGroups(groupsData);
                            }
                        }
                    }
                }
                else if (change.type === "removed") {
                    // Remove the job from our local array
                    const index = allJobs.findIndex(j => j.id === jobData.id);
                    if (index !== -1) {
                        allJobs.splice(index, 1);
                        needsRefresh = true;
                        
                        // If this is the currently open job, close the modal
                        if (currentJobID === jobData.id) {
                            const viewJobModal = document.getElementById('viewJobModal');
                            if (viewJobModal) {
                                const bsViewJobModal = bootstrap.Modal.getInstance(viewJobModal);
                                if (bsViewJobModal) {
                                    bsViewJobModal.hide();
                                }
                            }
                            
                            // Show toast notification
                            showToast("Info", "This job has been deleted by another user", "info");
                        }
                    }
                }
            });
            
            // If we need to refresh the UI
            if (needsRefresh) {
                // Refresh the current view
                const isArchivedTab = document.getElementById('completed-jobs-tab').classList.contains('active');
                
                // Filter jobs for the current tab
                const tabJobs = allJobs.filter(job => job.isArchived === isArchivedTab);
                
                // Apply current sort
                const sortSelect = document.getElementById('sortSelect');
                const currentSort = sortSelect ? sortSelect.value : 'date-desc';
                sortJobs(tabJobs, currentSort);
                
                // Display jobs
                displayJobs(tabJobs, isArchivedTab);
                
                // If search is active, refresh the search results
                if (isSearchActive) {
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput && searchInput.value.trim()) {
                        if (currentSearchType === 'jobs') {
                            searchJobs(searchInput.value.trim());
                        } else {
                            searchPlayers(searchInput.value.trim());
                        }
                    }
                }
            }
        }, (error) => {
            console.error("Error in real-time listener:", error);
        });
}

// Update existing records with the isArchived field
function updateExistingJobsWithArchiveField() {
    // Only run this once when we know the user is authenticated and has an organization ID
    if (!currentOrganizationID) return;
    
    console.log("Checking for sports jobs that need the isArchived field added...");
    
    // Get all jobs for this organization
    db.collection(SPORTS_JOBS_COLLECTION)
        .where("organizationID", "==", currentOrganizationID)
        .get()
        .then((querySnapshot) => {
            let updateCount = 0;
            const batch = db.batch();
            
            querySnapshot.forEach((doc) => {
                const job = doc.data();
                // If job doesn't have isArchived field
                if (job.isArchived === undefined) {
                    updateCount++;
                    // Default to false (active) for existing jobs
                    batch.update(doc.ref, { isArchived: false });
                }
            });
            
            if (updateCount > 0) {
                // Commit the batch update
                return batch.commit().then(() => {
                    console.log(`Updated ${updateCount} jobs with isArchived field`);
                    // Reload jobs after updating
                    loadJobs(false);
                });
            } else {
                console.log("No jobs needed updating");
                return Promise.resolve();
            }
        })
        .catch((error) => {
            console.error("Error updating existing jobs:", error);
        });
}

// Load jobs from Firestore
function loadJobs(isArchived = false) {
    if (!currentOrganizationID) {
        console.error("No organization ID available");
        return;
    }
    
    console.log(`Loading ${isArchived ? 'archived' : 'active'} jobs for organization:`, currentOrganizationID);
    
    const jobList = isArchived ? document.getElementById('archivedJobList') : document.getElementById('jobList');
    const loadingJobs = isArchived ? document.getElementById('loadingArchivedJobs') : document.getElementById('loadingJobs');
    const noJobs = isArchived ? document.getElementById('noArchivedJobs') : document.getElementById('noJobs');
    
    if (!jobList || !loadingJobs || !noJobs) {
        console.error("Job list elements not found");
        return;
    }
    
    // Clear previous jobs
    const jobCards = jobList.querySelectorAll('.job-card-container');
    jobCards.forEach(card => card.remove());
    
    // Show loading indicator
    loadingJobs.classList.remove('d-none');
    noJobs.classList.add('d-none');
    
    // Create the query properly to match your index
    const query = db.collection(SPORTS_JOBS_COLLECTION)
        .where("organizationID", "==", currentOrganizationID)
        .where("isArchived", "==", isArchived)
        .orderBy("shootDate", "desc");
    
    // Execute the query    
    query.get()
        .then((querySnapshot) => {
            loadingJobs.classList.add('d-none');
            
            if (querySnapshot.empty) {
                noJobs.classList.remove('d-none');
                // Clear stored jobs for this tab
                if (isArchived) {
                    allJobs = allJobs.filter(job => !job.isArchived);
                } else {
                    allJobs = allJobs.filter(job => job.isArchived);
                }
                return;
            }
            
            // Store fetched jobs
            let tabJobs = [];
            querySnapshot.forEach((doc) => {
                const job = doc.data();
                job.id = doc.id;
                tabJobs.push(job);
            });
            
            // Update stored jobs
            if (isArchived) {
                // Remove existing archived jobs and add new ones
                allJobs = allJobs.filter(job => !job.isArchived).concat(tabJobs);
            } else {
                // Remove existing active jobs and add new ones
                allJobs = allJobs.filter(job => job.isArchived).concat(tabJobs);
            }
            
            // Apply current sort if search/sort control exists
            const sortSelect = document.getElementById('sortSelect');
            if (sortSelect) {
                const currentSort = sortSelect.value;
                sortJobs(tabJobs, currentSort);
            }
            
            // Display jobs
            displayJobs(tabJobs, isArchived);
        })
        .catch((error) => {
            console.error(`Error loading ${isArchived ? 'archived' : 'active'} jobs:`, error);
            loadingJobs.classList.add('d-none');
            
            // Show error message
            const errorAlert = document.createElement('div');
            errorAlert.className = 'col-12 alert alert-danger';
            errorAlert.textContent = `Error loading ${isArchived ? 'completed' : 'active'} jobs: ${error.message}`;
            jobList.appendChild(errorAlert);
            
            // Show direct link to create index if it's an index error
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                const indexLink = document.createElement('div');
                indexLink.className = 'mt-2';
                const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/);
                if (urlMatch) {
                    indexLink.innerHTML = `<a href="${urlMatch[0]}" target="_blank" class="btn btn-sm btn-outline-primary">Create Required Index</a>`;
                    errorAlert.appendChild(indexLink);
                }
            }
        });
}

// Load archived jobs
function loadArchivedJobs() {
    // Reset folder view to root when loading archived jobs
    currentFolderView = { level: 'root', school: null, year: null };
    loadJobs(true);
}

// Display archived jobs with folder structure
function displayArchivedJobsWithFolders() {
    const jobList = document.getElementById('archivedJobList');
    const noJobs = document.getElementById('noArchivedJobs');
    const folderNav = document.getElementById('folderNavigation');
    
    if (!jobList || !noJobs) {
        console.error("Archived job list elements not found");
        return;
    }
    
    // Clear previous content
    const jobCards = jobList.querySelectorAll('.job-card-container, .folder-card-container');
    jobCards.forEach(card => card.remove());
    
    // Get archived jobs
    const archivedJobs = allJobs.filter(job => job.isArchived);
    
    if (archivedJobs.length === 0) {
        noJobs.classList.remove('d-none');
        if (folderNav) folderNav.style.display = 'none';
        return;
    }
    
    noJobs.classList.add('d-none');
    if (folderNav) folderNav.style.display = 'block';
    
    // Update breadcrumb
    updateBreadcrumb();
    
    // Display based on current folder level
    if (currentFolderView.level === 'root') {
        // Show schools as folders
        const schoolGroups = {};
        archivedJobs.forEach(job => {
            const school = job.schoolName || 'Unknown School';
            if (!schoolGroups[school]) {
                schoolGroups[school] = [];
            }
            schoolGroups[school].push(job);
        });
        
        // Sort schools alphabetically
        const sortedSchools = Object.keys(schoolGroups).sort();
        
        // Create folder cards for each school
        sortedSchools.forEach(school => {
            const folderCard = createFolderCard(
                school, 
                schoolGroups[school].length,
                () => {
                    currentFolderView = { level: 'school', school: school, year: null };
                    displayArchivedJobsWithFolders();
                }
            );
            jobList.appendChild(folderCard);
        });
    } else if (currentFolderView.level === 'school' && !currentFolderView.year) {
        // Show years as folders for selected school
        const schoolJobs = archivedJobs.filter(job => job.schoolName === currentFolderView.school);
        const yearGroups = {};
        
        schoolJobs.forEach(job => {
            let year;
            if (job.seasonType === 'League') {
                year = getLeagueYear(job.shootDate);
            } else {
                year = getSchoolYear(job.shootDate);
            }
            
            if (!yearGroups[year]) {
                yearGroups[year] = [];
            }
            yearGroups[year].push(job);
        });
        
        // Sort years in descending order (newest first)
        const sortedYears = Object.keys(yearGroups).sort((a, b) => {
            // Extract the first year from school year format or use as-is for league year
            const yearA = a.includes('-') ? parseInt(a.split('-')[0]) : parseInt(a);
            const yearB = b.includes('-') ? parseInt(b.split('-')[0]) : parseInt(b);
            return yearB - yearA;
        });
        
        // Create folder cards for each year
        sortedYears.forEach(year => {
            const folderCard = createFolderCard(
                year,
                yearGroups[year].length,
                () => {
                    currentFolderView.year = year;
                    displayArchivedJobsWithFolders();
                }
            );
            jobList.appendChild(folderCard);
        });
    } else if (currentFolderView.year) {
        // Show actual jobs for selected school and year
        const filteredJobs = archivedJobs.filter(job => {
            if (job.schoolName !== currentFolderView.school) return false;
            
            let year;
            if (job.seasonType === 'League') {
                year = getLeagueYear(job.shootDate);
            } else {
                year = getSchoolYear(job.shootDate);
            }
            
            return year === currentFolderView.year;
        });
        
        // Sort jobs by date (newest first)
        sortJobs(filteredJobs, 'date-desc');
        
        // Display jobs
        filteredJobs.forEach(job => {
            const jobCard = createJobCard(job, true);
            jobList.appendChild(jobCard);
        });
        
        // Re-ensure event listeners after adding job cards
        console.log("Archive job cards displayed, re-ensuring event listeners");
        setTimeout(() => {
            setupJobActions();
        }, 100);
    }
}

// Create job card element
function createJobCard(job, isArchived = false) {
    const cardContainer = document.createElement('div');
    cardContainer.className = 'col-md-6 col-xl-4 job-card-container';
    
    // Format date
    const date = new Date(job.shootDate.toDate ? job.shootDate.toDate() : job.shootDate);
    const formattedDate = date.toLocaleDateString();
    
    // Calculate stats - only count athletes with last names
    const rosterCount = countValidAthletes(job.roster);
    const totalRosterEntries = job.roster ? job.roster.length : 0;
    const blankCount = totalRosterEntries - rosterCount;
    const photographedCount = countPhotographedAthletes(job.roster);
    const groupsCount = job.groupImages ? job.groupImages.length : 0;
    
    // Add 'archived-job' class for styling archived jobs differently
    const cardClass = isArchived ? 'job-card archived-job' : 'job-card';
    
    // Determine the archive button style and text based on current status
    const archiveBtnClass = isArchived ? 'btn-outline-primary' : 'btn-outline-success';
    const archiveBtnIcon = isArchived ? 'bi-arrow-counterclockwise' : 'bi-check-circle';
    const archiveBtnText = isArchived ? 'Activate' : 'Complete';
    
    // Display season/type and optional sport
    const seasonTypeDisplay = job.seasonType || job.sportName || '';
    const sportDisplay = job.sportName && job.seasonType ? ` - ${job.sportName}` : '';
    
    cardContainer.innerHTML = `
        <div class="${cardClass}">
            <div class="job-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">${job.schoolName}</h5>
                <span class="badge bg-primary badge-pill">${seasonTypeDisplay}${sportDisplay}</span>
            </div>
            <div class="job-body">
                <div class="mb-3">
                    <p class="text-muted mb-1">
                        <i class="bi bi-calendar"></i> ${formattedDate}
                    </p>
                    ${job.location ? `<p class="text-muted mb-1"><i class="bi bi-geo-alt"></i> ${job.location}</p>` : ''}
                    ${job.photographer ? `<p class="text-muted mb-1"><i class="bi bi-person"></i> ${job.photographer}</p>` : ''}
                </div>
                
                <div class="d-flex mb-3">
                    <div class="me-3">
                        <span class="fw-bold">${rosterCount}</span>
                        <span class="text-muted">Athletes</span>
                        ${blankCount > 0 ? `<br><small class="text-warning">(${blankCount} blank)</small>` : ''}
                    </div>
                    <div class="me-3">
                        <span class="fw-bold">${photographedCount}</span>
                        <span class="text-muted">Photographed</span>
                        ${rosterCount > 0 ? `<br><small class="text-info">(${Math.round((photographedCount / rosterCount) * 100)}%)</small>` : ''}
                    </div>
                    <div>
                        <span class="fw-bold">${groupsCount}</span>
                        <span class="text-muted">Groups</span>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-sm btn-outline-secondary view-job-btn" data-job-id="${job.id}" data-listener-attached="true">
                        <i class="bi bi-eye"></i> View
                    </button>
                    <button class="btn btn-sm ${archiveBtnClass} toggle-archive-btn" data-job-id="${job.id}" data-is-archived="${job.isArchived}" data-listener-attached="true">
                        <i class="bi ${archiveBtnIcon}"></i> ${archiveBtnText}
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-job-btn" data-job-id="${job.id}" data-listener-attached="true">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return cardContainer;
}

// Delete a job
function deleteJob(jobId) {
    console.log("Deleting job:", jobId);
    
    // Show loading state on the delete button
    const deleteBtn = document.querySelector(`.delete-job-btn[data-job-id="${jobId}"]`);
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
    }
    
    // Delete the job from Firestore
    db.collection(SPORTS_JOBS_COLLECTION).doc(jobId).delete()
        .then(() => {
            console.log("Job deleted successfully");
            
            // Update the local jobs array
            allJobs = allJobs.filter(job => job.id !== jobId);
            
            // Remove the job card from the UI
            const jobCard = document.querySelector(`.job-card-container:has(.delete-job-btn[data-job-id="${jobId}"])`);
            if (jobCard) {
                jobCard.remove();
            }
            
            // Show success message
            showToast("Success", "Job deleted successfully");
            
            // Check if there are no more jobs and show the "no jobs" message
            const isArchivedTab = document.getElementById('completed-jobs-tab').classList.contains('active');
            const jobList = isArchivedTab ? document.getElementById('archivedJobList') : document.getElementById('jobList');
            const noJobs = isArchivedTab ? document.getElementById('noArchivedJobs') : document.getElementById('noJobs');
            
            if (jobList && noJobs) {
                const remainingJobs = jobList.querySelectorAll('.job-card-container');
                if (remainingJobs.length === 0) {
                    noJobs.classList.remove('d-none');
                }
            }
        })
        .catch((error) => {
            console.error("Error deleting job:", error);
            
            // Re-enable the delete button
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i> Delete';
            }
            
            // Show error message
            showToast("Error", "Failed to delete job: " + error.message, "error");
        });
}

// Render roster table
function renderRoster(roster) {
    console.log("Rendering roster with", roster ? roster.length : 0, "entries");
    
    const rosterTableBody = document.getElementById('rosterTableBody');
    
    if (!rosterTableBody) {
        console.error("Roster table body not found");
        return;
    }
    
    rosterTableBody.innerHTML = '';
    
    if (!roster || roster.length === 0) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-3">No athletes in this roster</td>
            </tr>
        `;
        return;
    }
    
    // Sort roster by first name (Subject ID) by default
    sortRosterEntries(roster, 'firstName', 'asc');
    displayRoster(roster);
    
    // Add event listener for Add Roster Entry button
    const addRosterEntryBtn = document.getElementById('addRosterEntryBtn');
    if (addRosterEntryBtn) {
        addRosterEntryBtn.onclick = function() {
            // Reset form
            const rosterEntryForm = document.getElementById('rosterEntryForm');
            if (rosterEntryForm) {
                rosterEntryForm.reset();
            }
            
            const entryIdInput = document.getElementById('entryId');
            if (entryIdInput) {
                entryIdInput.value = '';
            }
            
            const rosterEntryModalTitle = document.getElementById('rosterEntryModalTitle');
            if (rosterEntryModalTitle) {
                rosterEntryModalTitle.textContent = 'Add Athlete';
            }
            
            // Show modal
            const rosterEntryModal = document.getElementById('rosterEntryModal');
            if (rosterEntryModal) {
                let bsRosterEntryModal = bootstrap.Modal.getInstance(rosterEntryModal);
                if (!bsRosterEntryModal) {
                    bsRosterEntryModal = new bootstrap.Modal(rosterEntryModal);
                }
                bsRosterEntryModal.show();
                
                // Add event listener for modal hidden event
                rosterEntryModal.addEventListener('hidden.bs.modal', function onModalHidden() {
                    // Ensure all backdrops are removed
                    cleanupModalBackdrops();
                    // Remove this specific listener to avoid duplicate bindings
                    rosterEntryModal.removeEventListener('hidden.bs.modal', onModalHidden);
                }, { once: true });
            }
        };
    }
    
    // Add event listener for Refresh Roster button
    const refreshRosterBtn = document.getElementById('refreshRosterBtn');
    if (refreshRosterBtn) {
        refreshRosterBtn.onclick = function() {
            // Reload current job
            viewJob(currentJobID);
        };
    }
    
    // Add sorting functionality to table headers
    setupTableSorting();
    
    // Update the first name header to show it's sorted
    const firstNameHeader = document.querySelector('th[data-sort="firstName"]');
    if (firstNameHeader) {
        firstNameHeader.setAttribute('data-sort-dir', 'asc');
        const sortIcon = firstNameHeader.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.className = 'sort-icon bi bi-arrow-up';
        }
    }
}

// Sort roster entries
function sortRosterEntries(entries, field, direction) {
    entries.sort((a, b) => {
        const valueA = (a[field] || '').toLowerCase();
        const valueB = (b[field] || '').toLowerCase();
        
        if (direction === 'asc') {
            return valueA.localeCompare(valueB);
        } else {
            return valueB.localeCompare(valueA);
        }
    });
    
    return entries;
}

// Function to highlight and scroll to a specific player
function highlightAndScrollToPlayer(playerId) {
    // Find the row with this player
    const playerRow = document.querySelector(`tr:has(.editable-cell[data-entry-id="${playerId}"])`);
    
    if (playerRow) {
        // Add highlight class
        playerRow.classList.add('player-highlight');
        
        // Scroll to the row
        playerRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after 5 seconds
        setTimeout(() => {
            playerRow.classList.remove('player-highlight');
        }, 5000);
    }
}

// Display roster
function displayRoster(roster) {
    const rosterTableBody = document.getElementById('rosterTableBody');
    if (!rosterTableBody) return;
    
    rosterTableBody.innerHTML = '';
    
    roster.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="editable-cell" data-field="lastName" data-entry-id="${entry.id}">${entry.lastName || ''}</td>
            <td class="editable-cell" data-field="firstName" data-entry-id="${entry.id}">${entry.firstName || ''}</td>
            <td class="editable-cell" data-field="teacher" data-entry-id="${entry.id}">${entry.teacher || ''}</td>
            <td class="editable-cell" data-field="group" data-entry-id="${entry.id}">${entry.group || ''}</td>
            <td class="editable-cell" data-field="email" data-entry-id="${entry.id}">${entry.email || ''}</td>
            <td class="editable-cell" data-field="phone" data-entry-id="${entry.id}">${entry.phone || ''}</td>
            <td class="editable-cell" data-field="imageNumbers" data-entry-id="${entry.id}">${entry.imageNumbers || ''}</td>
            <td class="editable-cell" data-field="notes" data-entry-id="${entry.id}">${entry.notes || ''}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-roster-entry-btn" data-entry-id="${entry.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-roster-entry-btn" data-entry-id="${entry.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        rosterTableBody.appendChild(row);
    });
    
    // Set up inline editing for cells
    setupInlineEditing();
}

// Setup inline editing for roster cells
function setupInlineEditing() {
    const editableCells = document.querySelectorAll('.editable-cell');
    
    editableCells.forEach(cell => {
        cell.addEventListener('click', function() {
            // If already editing, return
            if (this.querySelector('input, textarea')) return;
            
            const originalValue = this.textContent;
            const field = this.dataset.field;
            const entryId = this.dataset.entryId;
            
            // Create input element
            let inputElement;
            if (field === 'notes') {
                inputElement = document.createElement('textarea');
                inputElement.className = 'form-control form-control-sm';
                inputElement.rows = 2;
            } else {
                inputElement = document.createElement('input');
                inputElement.type = field === 'email' ? 'email' : 'text';
                inputElement.className = 'form-control form-control-sm';
            }
            
            inputElement.value = originalValue;
            
            // Clear cell and add input
            this.innerHTML = '';
            this.appendChild(inputElement);
            inputElement.focus();
            inputElement.select();
            
            // Save on blur or Enter key
            const saveValue = () => {
                const newValue = inputElement.value.trim();
                
                // Update the local data
                const entry = rosterData.find(item => item.id === entryId);
                if (entry) {
                    entry[field] = newValue;
                    
                    // Update in Firestore
                    updateJobRoster(currentJobID, rosterData)
                        .then(() => {
                            // Update cell display
                            this.textContent = newValue;
                        })
                        .catch(error => {
                            // Revert on error
                            this.textContent = originalValue;
                            showToast("Error", "Failed to update field: " + error.message, "error");
                        });
                } else {
                    this.textContent = originalValue;
                }
            };
            
            // Cancel on Escape key
            const cancelEdit = () => {
                this.textContent = originalValue;
            };
            
            inputElement.addEventListener('blur', saveValue);
            
            inputElement.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && field !== 'notes') {
                    e.preventDefault();
                    saveValue();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    inputElement.removeEventListener('blur', saveValue);
                    cancelEdit();
                }
            });
        });
    });
}

// Render groups
function renderGroups(groups) {
    console.log("Rendering groups with", groups ? groups.length : 0, "entries");
    
    const groupsList = document.getElementById('groupsList');
    
    if (!groupsList) {
        console.error("Groups list not found");
        return;
    }
    
    groupsList.innerHTML = '';
    
    if (!groups || groups.length === 0) {
        groupsList.innerHTML = `
            <div class="alert alert-info">
                No group images added for this job yet.
            </div>
        `;
        return;
    }
    
    groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'card mb-3';
        groupItem.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <h6 class="card-title mb-2">${group.description}</h6>
                    <div>
                        <button class="btn btn-sm btn-outline-primary me-1 edit-group-btn" data-group-id="${group.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-group-btn" data-group-id="${group.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                ${group.imageNumbers ? `<p class="card-text mb-1"><strong>Image Numbers:</strong> ${group.imageNumbers}</p>` : ''}
                ${group.notes ? `<p class="card-text text-muted small mb-0"><strong>Notes:</strong> ${group.notes}</p>` : ''}
            </div>
        `;
        
        groupsList.appendChild(groupItem);
    });
}

// Render sports statistics with proper error handling
function renderSportsStats(job) {
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;
    
    // Show loading state
    statsContent.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading statistics...</span>
            </div>
            <p class="mt-2">Calculating organization-wide statistics...</p>
        </div>
    `;
    
    // Fetch organization-wide stats from playerSearchIndex
    fetchOrganizationStats()
        .then(orgStats => {
            // Debug: Log what stats we got back
            console.log("Stats received for rendering:", {
                totalAthletes: orgStats.totalAthletes,
                totalSports: orgStats.totalSports,
                sportStatsKeys: Object.keys(orgStats.sportStats || {}),
                firstFewSports: Object.keys(orgStats.sportStats || {}).slice(0, 5)
            });
            
            // Generate HTML for the enhanced stats dashboard
            let html = `
                <div class="stats-dashboard">
                    <!-- Header with Key Metrics -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="stats-header-card">
                                <div class="row text-center">
                                    <div class="col-md-2">
                                        <div class="metric-card">
                                            <div class="metric-number">${(typeof orgStats.totalSchools === 'number') ? orgStats.totalSchools : 0}</div>
                                            <div class="metric-label">Schools</div>
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="metric-card">
                                            <div class="metric-number">${(typeof orgStats.totalSports === 'number') ? orgStats.totalSports : 0}</div>
                                            <div class="metric-label">Sports</div>
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="metric-card">
                                            <div class="metric-number">${(typeof orgStats.totalAthletes === 'number') ? orgStats.totalAthletes : 0}</div>
                                            <div class="metric-label">Total Athletes</div>
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="metric-card">
                                            <div class="metric-number">${(typeof orgStats.totalPhotographed === 'number') ? orgStats.totalPhotographed : 0}</div>
                                            <div class="metric-label">Photographed</div>
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="metric-card">
                                            <div class="metric-number">${calculateTotalShoots(orgStats)}</div>
                                            <div class="metric-label">Total Shoots</div>
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="metric-card">
                                            <div class="metric-number">${(typeof orgStats.overallPercentage === 'number') ? orgStats.overallPercentage : 0}%</div>
                                            <div class="metric-label">Completion</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Charts Row -->
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div class="card chart-card">
                                <div class="card-header">
                                    <h6 class="mb-0">Athletes by Sport</h6>
                                </div>
                                <div class="card-body">
                                    <canvas id="athletesBySportChart" width="300" height="300"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card chart-card">
                                <div class="card-header">
                                    <h6 class="mb-0">Photography Progress</h6>
                                </div>
                                <div class="card-body">
                                    <canvas id="photographyProgressChart" width="300" height="300"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card chart-card">
                                <div class="card-header">
                                    <h6 class="mb-0">Season Distribution</h6>
                                </div>
                                <div class="card-body">
                                    <canvas id="seasonDistributionChart" width="300" height="300"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Metrics -->
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="card performance-card">
                                <div class="card-header">
                                    <h6 class="mb-0">📊 Top Performing Sports</h6>
                                </div>
                                <div class="card-body">
                                    ${generateTopPerformingSports(orgStats)}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card performance-card">
                                <div class="card-header">
                                    <h6 class="mb-0">⚡ Efficiency Metrics</h6>
                                </div>
                                <div class="card-body">
                                    ${generateEfficiencyMetrics(orgStats)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Detailed Sport Statistics -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">🏆 Detailed Sport Statistics</h6>
                                    <small class="text-muted">Statistics for Fall, Winter, and Spring sports only (League shoots not included)</small>
                                </div>
                                <div class="card-body">
                                    <div class="row">
            `;
            
            // Check if we have sport stats and they're valid
            if (!orgStats.sportStats || typeof orgStats.sportStats !== 'object') {
                html += `
                                        <div class="col-12">
                                            <div class="alert alert-warning">
                                                No sports statistics available. This may be because:
                                                <ul class="mb-0 mt-2">
                                                    <li>No athletes have been added to any jobs yet</li>
                                                    <li>All jobs are League type (which are excluded from these stats)</li>
                                                    <li>No athletes have sport/team assignments</li>
                                                </ul>
                                            </div>
                                        </div>
                `;
            } else {
                // Sort sports by completion percentage (highest first)
                const sortedSports = Object.keys(orgStats.sportStats).sort((a, b) => {
                    const statsA = orgStats.sportStats[a];
                    const statsB = orgStats.sportStats[b];
                    const percentageA = statsA.total > 0 ? (statsA.photographed / statsA.total) * 100 : 0;
                    const percentageB = statsB.total > 0 ? (statsB.photographed / statsB.total) * 100 : 0;
                    return percentageB - percentageA;
                });
                
                if (sortedSports.length === 0) {
                    html += `
                                        <div class="col-12">
                                            <div class="alert alert-info">
                                                No sports data available. Add athletes with sport/team assignments to see statistics.
                                            </div>
                                        </div>
                    `;
                } else {
                    sortedSports.forEach(sport => {
                        const stats = orgStats.sportStats[sport];
                        const total = (stats && typeof stats.total === 'number') ? stats.total : 0;
                        const photographed = (stats && typeof stats.photographed === 'number') ? stats.photographed : 0;
                        const shootCount = (stats && typeof stats.shootCount === 'number') ? stats.shootCount : 0;
                        const avgPhotographedPerShoot = (stats && typeof stats.averagePhotographedPerShoot === 'number') ? stats.averagePhotographedPerShoot : 0;
                        const percentage = total > 0 ? Math.round((photographed / total) * 100) : 0;
                        const progressClass = percentage === 100 ? 'bg-success' : percentage >= 80 ? 'bg-info' : percentage >= 50 ? 'bg-warning' : 'bg-danger';
                        
                        // Calculate additional metrics
                        const efficiency = shootCount > 0 ? (photographed / shootCount) : 0;
                        const completionStatus = percentage === 100 ? '✅' : percentage >= 80 ? '🟡' : '🔴';
                        
                        html += `
                                        <div class="col-lg-6 mb-3">
                                            <div class="sport-card">
                                                <div class="sport-header">
                                                    <h6 class="sport-title">${completionStatus} ${sport || 'No Sport Assigned'}</h6>
                                                    <span class="completion-badge ${progressClass.replace('bg-', 'badge-')}">${percentage}%</span>
                                                </div>
                                                <div class="sport-metrics">
                                                    <div class="metric-row">
                                                        <div class="metric-item">
                                                            <span class="metric-value">${total}</span>
                                                            <span class="metric-name">Athletes</span>
                                                        </div>
                                                        <div class="metric-item">
                                                            <span class="metric-value">${photographed}</span>
                                                            <span class="metric-name">Shot</span>
                                                        </div>
                                                        <div class="metric-item">
                                                            <span class="metric-value">${shootCount}</span>
                                                            <span class="metric-name">Shoots</span>
                                                        </div>
                                                        <div class="metric-item">
                                                            <span class="metric-value">${avgPhotographedPerShoot}</span>
                                                            <span class="metric-name">Avg/Shoot</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="progress-container">
                                                    <div class="progress sport-progress">
                                                        <div class="progress-bar ${progressClass}" role="progressbar" 
                                                             style="width: ${percentage}%;" 
                                                             aria-valuenow="${percentage}" 
                                                             aria-valuemin="0" 
                                                             aria-valuemax="100">
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                        `;
                    });
                }
            }
            
            html += `
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Set content and initialize charts
            statsContent.innerHTML = html;
            
            // Initialize charts after DOM is ready
            setTimeout(() => {
                initializeCharts(orgStats);
            }, 100);
        })
        .catch(error => {
            console.error("Error loading statistics:", error);
            statsContent.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Error loading statistics</h6>
                    <p class="mb-0">${error.message}</p>
                    <small class="text-muted">
                        This may be due to missing player search index data. Try refreshing the page or contact support if the issue persists.
                    </small>
                </div>
            `;
        });
}

// Helper function to calculate total shoots
function calculateTotalShoots(orgStats) {
    let totalShoots = 0;
    if (orgStats.sportStats && typeof orgStats.sportStats === 'object') {
        Object.values(orgStats.sportStats).forEach(sportStat => {
            if (sportStat && typeof sportStat.shootCount === 'number') {
                totalShoots += sportStat.shootCount;
            }
        });
    }
    return totalShoots;
}

// Generate top performing sports
function generateTopPerformingSports(orgStats) {
    if (!orgStats.sportStats) return '<p class="text-muted">No data available</p>';
    
    const sports = Object.entries(orgStats.sportStats)
        .filter(([sport, stats]) => stats.total > 0)
        .map(([sport, stats]) => ({
            sport,
            percentage: Math.round((stats.photographed / stats.total) * 100),
            photographed: stats.photographed,
            total: stats.total
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5);
    
    if (sports.length === 0) return '<p class="text-muted">No sports data available</p>';
    
    let html = '<div class="top-sports-list">';
    sports.forEach((sport, index) => {
        const medalIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        html += `
            <div class="top-sport-item">
                <span class="sport-rank">${medalIcon}</span>
                <span class="sport-name">${sport.sport}</span>
                <span class="sport-progress">${sport.percentage}% (${sport.photographed}/${sport.total})</span>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// Generate efficiency metrics
function generateEfficiencyMetrics(orgStats) {
    if (!orgStats.sportStats) return '<p class="text-muted">No data available</p>';
    
    const totalShoots = calculateTotalShoots(orgStats);
    const avgPhotographedPerShoot = totalShoots > 0 ? Math.round(orgStats.totalPhotographed / totalShoots) : 0;
    
    // Find most efficient sport (highest photographed per shoot)
    let mostEfficient = null;
    let highestAvg = 0;
    
    Object.entries(orgStats.sportStats).forEach(([sport, stats]) => {
        if (stats.averagePhotographedPerShoot > highestAvg) {
            highestAvg = stats.averagePhotographedPerShoot;
            mostEfficient = sport;
        }
    });
    
    // Calculate completion rate
    const completionRate = orgStats.totalAthletes > 0 ? 
        Math.round((orgStats.totalPhotographed / orgStats.totalAthletes) * 100) : 0;
    
    return `
        <div class="efficiency-metrics">
            <div class="efficiency-item">
                <div class="efficiency-label">📸 Avg Shot per Shoot</div>
                <div class="efficiency-value">${avgPhotographedPerShoot}</div>
            </div>
            <div class="efficiency-item">
                <div class="efficiency-label">⚡ Most Efficient Sport</div>
                <div class="efficiency-value">${mostEfficient || 'N/A'} (${highestAvg}/shoot)</div>
            </div>
            <div class="efficiency-item">
                <div class="efficiency-label">🎯 Overall Completion</div>
                <div class="efficiency-value">${completionRate}%</div>
            </div>
            <div class="efficiency-item">
                <div class="efficiency-label">📊 Total Sessions</div>
                <div class="efficiency-value">${totalShoots} shoots</div>
            </div>
        </div>
    `;
}

// Initialize charts using Chart.js
function initializeCharts(orgStats) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not available, skipping chart initialization');
        return;
    }
    
    // Athletes by Sport Chart
    initializeAthletesBySportChart(orgStats);
    
    // Photography Progress Chart
    initializePhotographyProgressChart(orgStats);
    
    // Season Distribution Chart
    initializeSeasonDistributionChart(orgStats);
}

// Initialize Athletes by Sport pie chart
function initializeAthletesBySportChart(orgStats) {
    const ctx = document.getElementById('athletesBySportChart');
    if (!ctx || !orgStats.sportStats) return;
    
    const sports = Object.entries(orgStats.sportStats)
        .filter(([sport, stats]) => stats.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8); // Top 8 sports
    
    const labels = sports.map(([sport]) => sport);
    const data = sports.map(([sport, stats]) => stats.total);
    const colors = generateColors(sports.length);
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Initialize Photography Progress chart
function initializePhotographyProgressChart(orgStats) {
    const ctx = document.getElementById('photographyProgressChart');
    if (!ctx) return;
    
    const photographed = orgStats.totalPhotographed || 0;
    const notPhotographed = (orgStats.totalAthletes || 0) - photographed;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Photographed', 'Not Photographed'],
            datasets: [{
                data: [photographed, notPhotographed],
                backgroundColor: ['#28a745', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Initialize Season Distribution chart
function initializeSeasonDistributionChart(orgStats) {
    const ctx = document.getElementById('seasonDistributionChart');
    if (!ctx || !orgStats.seasonStats) return;
    
    const seasons = Object.entries(orgStats.seasonStats)
        .filter(([season, stats]) => stats.total > 0);
    
    if (seasons.length === 0) return;
    
    const labels = seasons.map(([season]) => season.replace(' Sports', ''));
    const data = seasons.map(([season, stats]) => stats.total);
    const colors = ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, seasons.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Generate colors for charts
function generateColors(count) {
    const colors = [
        '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', 
        '#ff9f40', '#ff6384', '#c9cbcf', '#4bc0c0', '#ff6384'
    ];
    return colors.slice(0, count);
}

// Fetch organization-wide statistics from playerSearchIndex with improved error handling
function fetchOrganizationStats() {
    if (!currentOrganizationID) {
        return Promise.reject(new Error("No organization ID available"));
    }
    
    // Query playerSearchIndex for all players in the organization
    return db.collection("playerSearchIndex")
        .where("organizationID", "==", currentOrganizationID)
        .get()
        .then(querySnapshot => {
            const stats = {
                sportStats: {},
                seasonStats: {
                    'Fall Sports': { total: 0, photographed: 0 },
                    'Winter Sports': { total: 0, photographed: 0 },
                    'Spring Sports': { total: 0, photographed: 0 }
                },
                totalSchools: new Set(),
                totalSports: 0,
                totalAthletes: 0,
                totalPhotographed: 0,
                overallPercentage: 0
            };
            
            if (querySnapshot.empty) {
                console.log("No player search index data found");
                // Return stats with initialized values
                stats.totalSchools = 0;
                return stats;
            }
            
            // Debug: Log all unique seasonType values
            const seasonTypes = new Set();
            querySnapshot.forEach(doc => {
                const player = doc.data();
                if (player && player.seasonType) {
                    seasonTypes.add(player.seasonType);
                }
            });
            console.log("All seasonType values found:", Array.from(seasonTypes));
            
            querySnapshot.forEach(doc => {
                const player = doc.data();
                
                // Skip if not valid data
                if (!player || !player.lastName || player.lastName.trim() === '') return;
                
                // DEBUG: Log what we're about to check
                console.log(`Player: ${player.firstName} ${player.lastName}, seasonType: "${player.seasonType}", group: ${player.group}`);
                
                // Skip if League - DONE. NO LEAGUE PLAYERS.
                if (player.seasonType === 'League') {
                    console.log(`SKIPPING League player: ${player.firstName} ${player.lastName}`);
                    return;
                }
                
                console.log(`INCLUDING player: ${player.firstName} ${player.lastName}`);
                
                // Count this player
                stats.totalAthletes++;
                
                // Track schools
                if (player.schoolName) {
                    stats.totalSchools.add(player.schoolName);
                }
                
                // Track by sport
                const sport = player.group || 'No Sport Assigned';
                if (!stats.sportStats[sport]) {
                    stats.sportStats[sport] = { 
                        total: 0, 
                        photographed: 0, 
                        shoots: new Set(), 
                        schoolShootCombos: new Set() 
                    };
                }
                stats.sportStats[sport].total++;
                
                // Track shoots and school-shoot combinations for this sport
                if (player.jobId) {
                    stats.sportStats[sport].shoots.add(player.jobId);
                    if (player.schoolName) {
                        stats.sportStats[sport].schoolShootCombos.add(`${player.schoolName}-${player.jobId}`);
                    }
                }
                
                // Track if photographed
                if (player.imageNumbers && player.imageNumbers.trim() !== '') {
                    stats.sportStats[sport].photographed++;
                    stats.totalPhotographed++;
                }
                
                // Track by season
                if (stats.seasonStats[player.seasonType]) {
                    stats.seasonStats[player.seasonType].total++;
                    if (player.imageNumbers && player.imageNumbers.trim() !== '') {
                        stats.seasonStats[player.seasonType].photographed++;
                    }
                }
            });
            
            // Convert Sets to counts and calculate averages
            Object.keys(stats.sportStats).forEach(sport => {
                const sportData = stats.sportStats[sport];
                sportData.shootCount = sportData.shoots.size;
                // Calculate average based on PHOTOGRAPHED athletes only
                sportData.averagePhotographedPerShoot = sportData.shootCount > 0 ? 
                    Math.round(sportData.photographed / sportData.shootCount) : 0;
                
                // Clean up the Sets as they're no longer needed
                delete sportData.shoots;
                delete sportData.schoolShootCombos;
            });
            
            // Convert school Set to count
            stats.totalSchools = stats.totalSchools.size;
            stats.totalSports = Object.keys(stats.sportStats).length;
            
            // Calculate overall percentage
            stats.overallPercentage = stats.totalAthletes > 0 ? 
                Math.round((stats.totalPhotographed / stats.totalAthletes) * 100) : 0;
            
            // Debug: Log the final stats that will be returned
            console.log("Final calculated stats:", {
                totalAthletes: stats.totalAthletes,
                totalSports: stats.totalSports,
                sportStats: Object.keys(stats.sportStats),
                sampleSportStats: Object.entries(stats.sportStats).slice(0, 3)
            });
            
            // Debug: This should be ZERO if all players are League
            console.log("DEBUG: We processed", querySnapshot.size, "total player records");
            console.log("DEBUG: Final athlete count is", stats.totalAthletes);
            console.log("DEBUG: If these don't match, there's a bug in the logic");
            
            return stats;
        })
        .catch(error => {
            console.error("Error fetching organization stats:", error);
            // Don't fall back - show error instead
            throw error;
        });
}

// Fallback function to calculate stats from regular jobs when playerSearchIndex is not available
function calculateStatsFromJobs() {
    console.log("Falling back to calculating stats from jobs data");
    
    const stats = {
        sportStats: {},
        seasonStats: {
            'Fall Sports': { total: 0, photographed: 0 },
            'Winter Sports': { total: 0, photographed: 0 },
            'Spring Sports': { total: 0, photographed: 0 }
        },
        totalSchools: new Set(),
        totalSports: 0,
        totalAthletes: 0,
        totalPhotographed: 0,
        overallPercentage: 0
    };
    
    // Process all jobs to calculate stats
    allJobs.forEach(job => {
        // Skip League jobs
        if (job.seasonType === 'League') return;
        
        // Only include Fall, Winter, and Spring Sports
        if (job.seasonType !== 'Fall Sports' && 
            job.seasonType !== 'Winter Sports' && 
            job.seasonType !== 'Spring Sports') return;
        
        // Track schools
        if (job.schoolName) {
            stats.totalSchools.add(job.schoolName);
        }
        
        // Process roster
        if (job.roster && Array.isArray(job.roster)) {
            job.roster.forEach(athlete => {
                // Only count athletes with last names
                if (!athlete.lastName || athlete.lastName.trim() === '') return;
                
                // Also exclude based on common league sport patterns
                const sport = (athlete.group || '').toLowerCase();
                const isLeagueSport = sport.includes('coach pitch') || 
                                    sport.includes('ll boys') || 
                                    sport.includes('ll girls') ||
                                    sport.includes('tee ball') ||
                                    sport.includes('little league') ||
                                    sport.includes('coach-pitch') ||
                                    sport.includes('t-ball');
                
                if (isLeagueSport) return;
                
                const sportName = athlete.group || 'No Sport Assigned';
                
                if (!stats.sportStats[sportName]) {
                    stats.sportStats[sportName] = {
                        total: 0,
                        photographed: 0
                    };
                }
                
                stats.sportStats[sportName].total++;
                stats.totalAthletes++;
                
                if (athlete.imageNumbers && athlete.imageNumbers.trim() !== '') {
                    stats.sportStats[sportName].photographed++;
                    stats.totalPhotographed++;
                }
                
                // Track by season type
                if (job.seasonType && stats.seasonStats[job.seasonType]) {
                    stats.seasonStats[job.seasonType].total++;
                    if (athlete.imageNumbers && athlete.imageNumbers.trim() !== '') {
                        stats.seasonStats[job.seasonType].photographed++;
                    }
                }
            });
        }
    });
    
    // Convert school Set to count
    stats.totalSchools = stats.totalSchools.size;
    stats.totalSports = Object.keys(stats.sportStats).length;
    
    // Calculate overall percentage
    stats.overallPercentage = stats.totalAthletes > 0 ? 
        Math.round((stats.totalPhotographed / stats.totalAthletes) * 100) : 0;
    
    return Promise.resolve(stats);
}

// Calculate organization-wide statistics (deprecated - keeping for compatibility)
function calculateOrganizationStats() {
    // This function is no longer used but kept for compatibility
    // The new fetchOrganizationStats function fetches from playerSearchIndex instead
    console.warn("calculateOrganizationStats is deprecated. Use fetchOrganizationStats instead.");
    return fetchOrganizationStats();
}

// Render job-specific statistics
function renderJobStats(job) {
    const jobStatsContent = document.getElementById('jobStatsContent');
    if (!jobStatsContent) return;
    
    // Calculate stats for this specific job
    const stats = calculateJobStats(job.roster);
    
    let html = `
        <div class="row">
            <div class="col-12">
                <h6 class="mb-3">Photography Progress for This Shoot</h6>
            </div>
        </div>
    `;
    
    // If it's a League shoot, show simple stats
    if (job.seasonType === 'League') {
        html += `
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">League Shoot Statistics</h6>
                            <div class="row">
                                <div class="col-md-4">
                                    <strong>Total Athletes:</strong> ${stats.totalAthletes}
                                </div>
                                <div class="col-md-4">
                                    <strong>Photographed:</strong> ${stats.totalPhotographed}
                                </div>
                                <div class="col-md-4">
                                    <strong>Progress:</strong> ${stats.overallPercentage}%
                                </div>
                            </div>
                            <div class="progress mt-3" style="height: 25px;">
                                <div class="progress-bar ${stats.overallPercentage === 100 ? 'bg-success' : stats.overallPercentage >= 50 ? 'bg-info' : 'bg-warning'}" 
                                     role="progressbar" 
                                     style="width: ${stats.overallPercentage}%;" 
                                     aria-valuenow="${stats.overallPercentage}" 
                                     aria-valuemin="0" 
                                     aria-valuemax="100">
                                    ${stats.overallPercentage}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // For Fall, Winter, Spring sports, show breakdown by sport
        html += `<div class="row">`;
        
        const sortedSports = Object.keys(stats.sportStats).sort();
        
        if (sortedSports.length === 0) {
            html += `
                <div class="col-12">
                    <div class="alert alert-info">
                        No sports data available for this shoot.
                    </div>
                </div>
            `;
        } else {
            sortedSports.forEach(sport => {
                const sportStat = stats.sportStats[sport];
                const percentage = sportStat.total > 0 ? Math.round((sportStat.photographed / sportStat.total) * 100) : 0;
                const progressClass = percentage === 100 ? 'bg-success' : percentage >= 50 ? 'bg-info' : 'bg-warning';
                
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">${sport || 'No Sport Assigned'}</h6>
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Athletes: ${sportStat.total}</span>
                                    <span>Photographed: ${sportStat.photographed}</span>
                                </div>
                                <div class="progress" style="height: 20px;">
                                    <div class="progress-bar ${progressClass}" role="progressbar" 
                                         style="width: ${percentage}%;" 
                                         aria-valuenow="${percentage}" 
                                         aria-valuemin="0" 
                                         aria-valuemax="100">
                                        ${percentage}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        
        // Add overall summary
        html += `
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title">Shoot Summary</h6>
                            <div class="row">
                                <div class="col-md-3">
                                    <strong>Total Sports:</strong> ${stats.totalSports}
                                </div>
                                <div class="col-md-3">
                                    <strong>Total Athletes:</strong> ${stats.totalAthletes}
                                </div>
                                <div class="col-md-3">
                                    <strong>Photographed:</strong> ${stats.totalPhotographed}
                                </div>
                                <div class="col-md-3">
                                    <strong>Overall Progress:</strong> ${stats.overallPercentage}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    jobStatsContent.innerHTML = html;
}

// Calculate statistics for a specific job
function calculateJobStats(roster) {
    const stats = {
        sportStats: {},
        totalSports: 0,
        totalAthletes: 0,
        totalPhotographed: 0,
        overallPercentage: 0
    };
    
    if (!roster || !Array.isArray(roster)) return stats;
    
    roster.forEach(athlete => {
        // Only count athletes with last names (valid athletes)
        if (!athlete.lastName || athlete.lastName.trim() === '') return;
        
        const sport = athlete.group || 'No Sport Assigned';
        
        if (!stats.sportStats[sport]) {
            stats.sportStats[sport] = {
                total: 0,
                photographed: 0
            };
        }
        
        stats.sportStats[sport].total++;
        stats.totalAthletes++;
        
        if (athlete.imageNumbers && athlete.imageNumbers.trim() !== '') {
            stats.sportStats[sport].photographed++;
            stats.totalPhotographed++;
        }
    });
    
    stats.totalSports = Object.keys(stats.sportStats).length;
    stats.overallPercentage = stats.totalAthletes > 0 ? 
        Math.round((stats.totalPhotographed / stats.totalAthletes) * 100) : 0;
    
    return stats;
}

// Setup sports stats refresh button
function setupSportsStats() {
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', function() {
            // Refresh the stats by re-rendering
            renderSportsStats(null); // Pass null since we don't need a specific job
        });
    }
}

// Function to handle job sorting
function sortJobs(jobs, sortType) {
    switch (sortType) {
        case 'date-desc':
            jobs.sort((a, b) => {
                const dateA = a.shootDate && a.shootDate.toDate ? a.shootDate.toDate() : new Date(a.shootDate);
                const dateB = b.shootDate && b.shootDate.toDate ? b.shootDate.toDate() : new Date(b.shootDate);
                return dateB - dateA; // Newest first
            });
            break;
        case 'date-asc':
            jobs.sort((a, b) => {
                const dateA = a.shootDate && a.shootDate.toDate ? a.shootDate.toDate() : new Date(a.shootDate);
                const dateB = b.shootDate && b.shootDate.toDate ? b.shootDate.toDate() : new Date(b.shootDate);
                return dateA - dateB; // Oldest first
            });
            break;
        case 'name-asc':
            jobs.sort((a, b) => (a.schoolName || '').localeCompare(b.schoolName || '')); // A-Z
            break;
        case 'name-desc':
            jobs.sort((a, b) => (b.schoolName || '').localeCompare(a.schoolName || '')); // Z-A
            break;
        case 'seasonType-asc':
            jobs.sort((a, b) => (a.seasonType || a.sportName || '').localeCompare(b.seasonType || b.sportName || '')); // A-Z
            break;
        case 'seasonType-desc':
            jobs.sort((a, b) => (b.seasonType || b.sportName || '').localeCompare(a.seasonType || a.sportName || '')); // Z-A
            break;
        case 'sport-asc':
            jobs.sort((a, b) => (a.sportName || '').localeCompare(b.sportName || '')); // A-Z
            break;
        case 'sport-desc':
            jobs.sort((a, b) => (b.sportName || '').localeCompare(a.sportName || '')); // Z-A
            break;
        default:
            // Default to newest first
            jobs.sort((a, b) => {
                const dateA = a.shootDate && a.shootDate.toDate ? a.shootDate.toDate() : new Date(a.shootDate);
                const dateB = b.shootDate && b.shootDate.toDate ? b.shootDate.toDate() : new Date(b.shootDate);
                return dateB - dateA;
            });
    }
    
    return jobs; // Return sorted array
}

// Function to display jobs
function displayJobs(jobs, isArchived = false) {
    const jobList = isArchived ? document.getElementById('archivedJobList') : document.getElementById('jobList');
    const noJobs = isArchived ? document.getElementById('noArchivedJobs') : document.getElementById('noJobs');
    
    if (!jobList || !noJobs) {
        console.error("Job list elements not found");
        return;
    }
    
    // Clear previous jobs
    const jobCards = jobList.querySelectorAll('.job-card-container, .folder-card-container');
    jobCards.forEach(card => card.remove());
    
    if (jobs.length === 0) {
        noJobs.classList.remove('d-none');
        // Hide folder navigation if in archived view
        if (isArchived) {
            const folderNav = document.getElementById('folderNavigation');
            if (folderNav) folderNav.style.display = 'none';
        }
        return;
    }
    
    noJobs.classList.add('d-none');
    
    // For archived jobs, use folder structure
    if (isArchived && !isSearchActive) {
        displayArchivedJobsWithFolders();
    } else {
        // Display jobs normally (for active jobs or when searching)
        jobs.forEach(job => {
            const jobCard = createJobCard(job, isArchived);
            jobList.appendChild(jobCard);
        });
        
        // Hide folder navigation when searching
        if (isArchived && isSearchActive) {
            const folderNav = document.getElementById('folderNavigation');
            if (folderNav) folderNav.style.display = 'none';
        }
    }
    
    // Re-ensure event listeners are attached after DOM changes
    console.log("Jobs displayed, re-ensuring event listeners are active");
    
    // Small delay to ensure DOM is fully updated
    setTimeout(() => {
        // Force re-setup of job actions to ensure all buttons work
        setupJobActions();
    }, 100);
}

// Function to search jobs
function searchJobs(query) {
    if (!query) {
        // If query is empty, reset to default view
        resetSearch();
        return;
    }
    
    isSearchActive = true;
    
    // Make search case-insensitive
    const searchTerm = query.toLowerCase();
    
    // Get currently active tab
    const isArchivedTab = document.getElementById('completed-jobs-tab').classList.contains('active');
    
    // Filter jobs based on search term
    const filteredJobs = allJobs.filter(job => {
        // Only show jobs from the current tab (active or archived)
        if (job.isArchived !== isArchivedTab) return false;
        
        // Search in school name, season/type, sport name, location, and photographer
        return (
            (job.schoolName || '').toLowerCase().includes(searchTerm) ||
            (job.seasonType || '').toLowerCase().includes(searchTerm) ||
            (job.sportName || '').toLowerCase().includes(searchTerm) ||
            (job.location || '').toLowerCase().includes(searchTerm) ||
            (job.photographer || '').toLowerCase().includes(searchTerm) ||
            (job.additionalNotes || '').toLowerCase().includes(searchTerm)
        );
    });
    
    // Apply current sort to filtered results
    const currentSort = document.getElementById('sortSelect').value;
    sortJobs(filteredJobs, currentSort);
    
    // Display filtered jobs
    displayJobs(filteredJobs, isArchivedTab);
    
    // Show "no results" message if needed
    const noJobs = isArchivedTab ? document.getElementById('noArchivedJobs') : document.getElementById('noJobs');
    if (noJobs) {
        if (filteredJobs.length === 0) {
            noJobs.textContent = `No jobs found matching "${query}"`;
            noJobs.classList.remove('d-none');
        } else {
            noJobs.classList.add('d-none');
        }
    }
    
    // Show clear button
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.style.display = 'block';
    }
}

// Function to search players
function searchPlayers(query) {
    if (!query) {
        resetSearch();
        return;
    }
    
    isSearchActive = true;
    
    // Make search case-insensitive
    const searchTerm = query.toLowerCase();
    
    // Show loading state
    const playerResultsContent = document.getElementById('playerResultsContent');
    if (playerResultsContent) {
        playerResultsContent.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Searching players...</span>
                </div>
                <p class="mt-2">Searching for players matching "${query}"...</p>
            </div>
        `;
    }
    
    // Show the player search results section
    const playerSearchResults = document.getElementById('playerSearchResults');
    if (playerSearchResults) {
        playerSearchResults.style.display = 'block';
    }
    
    // Store search results
    let searchResults = [];
    
    // This will be an asynchronous operation to search through all jobs
    const searchPromises = allJobs.map(job => {
        return new Promise((resolve) => {
            // Make sure job has a roster
            const roster = job.roster || [];
            
            // Find matching players in this job's roster
            const matchingPlayers = roster.filter(player => {
                return (
                    (player.firstName || '').toLowerCase().includes(searchTerm) ||
                    (player.lastName || '').toLowerCase().includes(searchTerm) ||
                    (player.group || '').toLowerCase().includes(searchTerm) ||
                    (player.teacher || '').toLowerCase().includes(searchTerm) ||
                    (player.email || '').toLowerCase().includes(searchTerm) ||
                    (player.phone || '').toLowerCase().includes(searchTerm) ||
                    (player.imageNumbers || '').toLowerCase().includes(searchTerm) ||
                    (player.notes || '').toLowerCase().includes(searchTerm)
                );
            });
            
            // Add job context to each matching player
            matchingPlayers.forEach(player => {
                searchResults.push({
                    jobId: job.id,
                    schoolName: job.schoolName,
                    seasonType: job.seasonType,
                    sportName: job.sportName,
                    shootDate: job.shootDate,
                    isArchived: job.isArchived,
                    player: player
                });
            });
            
            resolve();
        });
    });
    
    // Wait for all search promises to complete
    Promise.all(searchPromises)
        .then(() => {
            // Display search results
            displayPlayerSearchResults(searchResults, query);
            
            // Show clear button
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            if (clearSearchBtn) {
                clearSearchBtn.style.display = 'block';
            }
        });
}

// Function to display player search results
function displayPlayerSearchResults(results, query) {
    const playerResultsContent = document.getElementById('playerResultsContent');
    if (!playerResultsContent) return;
    
    if (results.length === 0) {
        playerResultsContent.innerHTML = `
            <div class="alert alert-info mb-0">
                No players found matching "${query}".
            </div>
        `;
        return;
    }
    
    // Group results by job for better organization
    const resultsByJob = {};
    results.forEach(result => {
        if (!resultsByJob[result.jobId]) {
            resultsByJob[result.jobId] = {
                jobId: result.jobId,
                schoolName: result.schoolName,
                seasonType: result.seasonType,
                sportName: result.sportName,
                shootDate: result.shootDate,
                isArchived: result.isArchived,
                players: []
            };
        }
        resultsByJob[result.jobId].players.push(result.player);
    });
    
    // Convert to array and sort by date (newest first)
    const sortedJobs = Object.values(resultsByJob).sort((a, b) => {
        const dateA = a.shootDate && a.shootDate.toDate ? a.shootDate.toDate() : new Date(a.shootDate);
        const dateB = b.shootDate && b.shootDate.toDate ? b.shootDate.toDate() : new Date(b.shootDate);
        return dateB - dateA;
    });
    
    // Create HTML content
    let html = `
        <div class="player-search-summary mb-3">
            <p class="mb-1">Found ${results.length} player(s) matching "${query}" across ${sortedJobs.length} job(s).</p>
        </div>
    `;
    
    // Generate results by job
    sortedJobs.forEach(job => {
        const date = job.shootDate && job.shootDate.toDate ? job.shootDate.toDate() : new Date(job.shootDate);
        const formattedDate = date.toLocaleDateString();
        
        // Display season/type and optional sport
        const seasonTypeDisplay = job.seasonType || job.sportName || '';
        const sportDisplay = job.sportName && job.seasonType ? ` - ${job.sportName}` : '';
        
        html += `
            <div class="job-player-results mb-4">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0">${job.schoolName} - ${seasonTypeDisplay}${sportDisplay}</h5>
                    <span class="badge ${job.isArchived ? 'bg-success' : 'bg-primary'}">${job.isArchived ? 'Completed' : 'Active'}</span>
                </div>
                <p class="text-muted mb-2"><i class="bi bi-calendar"></i> ${formattedDate}</p>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th>Last Name</th>
                                <th>First Name</th>
                                <th>Teacher</th>
                                <th>Group</th>
                                <th>Images</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Add players for this job
        job.players.forEach(player => {
            html += `
                <tr>
                    <td>${player.lastName || ''}</td>
                    <td>${player.firstName || ''}</td>
                    <td>${player.teacher || ''}</td>
                    <td>${player.group || ''}</td>
                    <td>${player.imageNumbers || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-primary view-player-job-btn" data-job-id="${job.jobId}">
                            <i class="bi bi-eye"></i> View Job
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    // Set content
    playerResultsContent.innerHTML = html;
    
    // Add event listeners to view job buttons
    const viewButtons = playerResultsContent.querySelectorAll('.view-player-job-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const jobId = this.getAttribute('data-job-id');
            // Get the player data from the row
            const row = this.closest('tr');
            const playerData = {
                lastName: row.cells[0].textContent,
                firstName: row.cells[1].textContent
            };
            
            // Find the player ID in the results
            let playerId = null;
            for (const result of results) {
                if (result.jobId === jobId && 
                    result.player.lastName === playerData.lastName && 
                    result.player.firstName === playerData.firstName) {
                    playerId = result.player.id;
                    break;
                }
            }
            
            viewJob(jobId, playerId);
        });
    });
}

// Function to reset search to default view
function resetSearch() {
    isSearchActive = false;
    
    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Hide clear button
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.style.display = 'none';
    }
    
    // Hide player search results
    const playerSearchResults = document.getElementById('playerSearchResults');
    if (playerSearchResults) {
        playerSearchResults.style.display = 'none';
    }
    
    // Get the active tab
    const isArchivedTab = document.getElementById('completed-jobs-tab').classList.contains('active');
    
    // Get current sort
    const sortSelect = document.getElementById('sortSelect');
    const currentSort = sortSelect ? sortSelect.value : 'date-desc';
    
    // Filter jobs for the current tab
    const tabJobs = allJobs.filter(job => job.isArchived === isArchivedTab);
    
    // Apply sort
    sortJobs(tabJobs, currentSort);
    
    // Display jobs
    displayJobs(tabJobs, isArchivedTab);
    
    // Reset "no jobs" text if needed
    const noJobs = isArchivedTab ? document.getElementById('noArchivedJobs') : document.getElementById('noJobs');
    if (noJobs) {
        noJobs.textContent = isArchivedTab ? 
            'No completed jobs found. Jobs marked as complete will appear here.' : 
            'No active sports jobs found. Create your first job to get started.';
    }
    
    // Reset folder view if in archived tab
    if (isArchivedTab) {
        currentFolderView = { level: 'root', school: null, year: null };
    }
}

// Setup function for search and sort controls
function setupSearchAndSort() {
    console.log("Setting up search and sort controls");
    
    // Get elements
    const searchInput = document.getElementById('searchInput');
    const searchTypeOptions = document.querySelectorAll('.search-type-option');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const sortSelect = document.getElementById('sortSelect');
    const closePlayerSearchBtn = document.getElementById('closePlayerSearchBtn');
    
    // Setup search input
    if (searchInput) {
        // Use input event for real-time search
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            
            // Wait for the user to stop typing for 300ms before searching
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                if (currentSearchType === 'jobs') {
                    searchJobs(query);
                } else {
                    searchPlayers(query);
                }
            }, 300);
        });
        
        // Also handle Enter key
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = this.value.trim();
                if (currentSearchType === 'jobs') {
                    searchJobs(query);
                } else {
                    searchPlayers(query);
                }
            }
        });
    }
    
    // Setup search type options
    if (searchTypeOptions) {
        searchTypeOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Update search type
                currentSearchType = this.getAttribute('data-type');
                
                // Update dropdown button text
                const searchTypeText = document.getElementById('searchTypeText');
                if (searchTypeText) {
                    searchTypeText.textContent = currentSearchType === 'jobs' ? 'Search Jobs' : 'Search Players';
                }
                
                // Clear existing search
                if (searchInput) {
                    // Update placeholder
                    searchInput.placeholder = currentSearchType === 'jobs' ? 
                        'Search jobs...' : 'Search players...';
                    
                    // Perform search with current value if not empty
                    const query = searchInput.value.trim();
                    if (query) {
                        if (currentSearchType === 'jobs') {
                            searchJobs(query);
                        } else {
                            searchPlayers(query);
                        }
                    } else {
                        resetSearch();
                    }
                }
            });
        });
    }
    
    // Setup clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', resetSearch);
    }
    
    // Setup sort select
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            const sortType = this.value;
            
            if (isSearchActive) {
                // If search is active, we need to reapply the search with the new sort
                if (searchInput) {
                    const query = searchInput.value.trim();
                    if (query) {
                        if (currentSearchType === 'jobs') {
                            searchJobs(query);
                        } else {
                            searchPlayers(query);
                        }
                    }
                }
            } else {
                // Otherwise just sort the current jobs list
                const isArchivedTab = document.getElementById('completed-jobs-tab').classList.contains('active');
                const tabJobs = allJobs.filter(job => job.isArchived === isArchivedTab);
                sortJobs(tabJobs, sortType);
                displayJobs(tabJobs, isArchivedTab);
            }
        });
    }
    
    // Setup close player search button
    if (closePlayerSearchBtn) {
        closePlayerSearchBtn.addEventListener('click', function() {
            resetSearch();
        });
    }
    
    // Setup tab switching to handle search and sort persistence
    const activeJobsTab = document.getElementById('active-jobs-tab');
    const completedJobsTab = document.getElementById('completed-jobs-tab');
    
    if (activeJobsTab && completedJobsTab) {
        // Save current search and sort when switching tabs
        activeJobsTab.addEventListener('shown.bs.tab', () => {
            if (isSearchActive) {
                // Reapply search with current settings for the new tab
                if (searchInput) {
                    const query = searchInput.value.trim();
                    if (query) {
                        if (currentSearchType === 'jobs') {
                            searchJobs(query);
                        } else {
                            searchPlayers(query);
                        }
                    }
                }
            } else {
                // Just sort and display active jobs
                const tabJobs = allJobs.filter(job => !job.isArchived);
                const currentSort = sortSelect ? sortSelect.value : 'date-desc';
                sortJobs(tabJobs, currentSort);
                displayJobs(tabJobs, false);
            }
        });
        
        completedJobsTab.addEventListener('shown.bs.tab', () => {
            if (isSearchActive) {
                // Reapply search with current settings for the new tab
                if (searchInput) {
                    const query = searchInput.value.trim();
                    if (query) {
                        if (currentSearchType === 'jobs') {
                            searchJobs(query);
                        } else {
                            searchPlayers(query);
                        }
                    }
                }
            } else {
                // Just sort and display archived jobs
                const tabJobs = allJobs.filter(job => job.isArchived);
                const currentSort = sortSelect ? sortSelect.value : 'date-desc';
                sortJobs(tabJobs, currentSort);
                displayJobs(tabJobs, true);
            }
        });
    }
}

// Setup Group Form
function setupGroupForm() {
    console.log("Setting up group form");
    
    const saveGroupBtn = document.getElementById('saveGroupBtn');
    if (!saveGroupBtn) {
        console.log("Save group button not found");
        return;
    }
    
    saveGroupBtn.addEventListener('click', function() {
        // Get form values
        const groupId = document.getElementById('groupId').value;
        const description = document.getElementById('description').value.trim();
        const groupImageNumbers = document.getElementById('groupImageNumbers').value.trim();
        const groupNotes = document.getElementById('groupNotes').value.trim();
        
        if (!description) {
            alert('Please enter a description for the group');
            return;
        }
        
        // Create group object
        const group = {
            id: groupId || generateUniqueId(),
            description,
            imageNumbers: groupImageNumbers,
            notes: groupNotes
        };
        
        // Check if adding new or editing existing group
        if (groupId) {
            // Edit existing group
            const index = groupsData.findIndex(item => item.id === groupId);
            if (index !== -1) {
                groupsData[index] = group;
            }
        } else {
            // Add new group
            groupsData.push(group);
        }
        
        // Save to Firestore
        updateJobGroups(currentJobID, groupsData);
        
        // Close modal
        const groupModal = document.getElementById('groupModal');
        if (groupModal) {
            const bsGroupModal = bootstrap.Modal.getInstance(groupModal);
            if (bsGroupModal) {
                bsGroupModal.hide();
            }
        }
    });
    
    // Attach event handlers to the Add Group button
    const addGroupBtn = document.getElementById('addGroupBtn');
    if (addGroupBtn) {
        addGroupBtn.addEventListener('click', function() {
            // Reset form
            const groupForm = document.getElementById('groupForm');
            if (groupForm) {
                groupForm.reset();
            }
            
            const groupIdInput = document.getElementById('groupId');
            if (groupIdInput) {
                groupIdInput.value = '';
            }
            
            const groupModalTitle = document.getElementById('groupModalTitle');
            if (groupModalTitle) {
                groupModalTitle.textContent = 'Add Group';
            }
            
            // Show modal
            const groupModal = document.getElementById('groupModal');
            if (groupModal) {
                let bsGroupModal = bootstrap.Modal.getInstance(groupModal);
                if (!bsGroupModal) {
                    bsGroupModal = new bootstrap.Modal(groupModal);
                }
                bsGroupModal.show();
            }
        });
    }
    
    // Attach event handlers to edit and delete buttons for groups
    document.addEventListener('click', function(event) {
        // Edit group
        if (event.target.closest('.edit-group-btn')) {
            const groupId = event.target.closest('.edit-group-btn').dataset.groupId;
            editGroup(groupId);
        }
        
        // Delete group
        if (event.target.closest('.delete-group-btn')) {
            const groupId = event.target.closest('.delete-group-btn').dataset.groupId;
            if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
                deleteGroup(groupId);
            }
        }
    });
    
    // Refresh groups button
    const refreshGroupsBtn = document.getElementById('refreshGroupsBtn');
    if (refreshGroupsBtn) {
        refreshGroupsBtn.addEventListener('click', function() {
            // Reload current job
            viewJob(currentJobID);
        });
    }
}

// Edit group
function editGroup(groupId) {
    console.log("Editing group:", groupId);
    
    // Find group in groups data
    const group = groupsData.find(item => item.id === groupId);
    if (!group) {
        console.error("Group not found");
        return;
    }
    
    // Set form values
    document.getElementById('groupId').value = group.id;
    document.getElementById('description').value = group.description || '';
    document.getElementById('groupImageNumbers').value = group.imageNumbers || '';
    document.getElementById('groupNotes').value = group.notes || '';
    
    // Update modal title
    const groupModalTitle = document.getElementById('groupModalTitle');
    if (groupModalTitle) {
        groupModalTitle.textContent = 'Edit Group';
    }
    
    // Show modal
    const groupModal = document.getElementById('groupModal');
    if (groupModal) {
        let bsGroupModal = bootstrap.Modal.getInstance(groupModal);
        if (!bsGroupModal) {
            bsGroupModal = new bootstrap.Modal(groupModal);
        }
        bsGroupModal.show();
    }
}

// Delete group
function deleteGroup(groupId) {
    console.log("Deleting group:", groupId);
    
    // Filter out the group from groups data
    groupsData = groupsData.filter(item => item.id !== groupId);
    
    // Save to Firestore
    updateJobGroups(currentJobID, groupsData);
    
    // Re-render groups
    renderGroups(groupsData);
}

// Update job groups in Firestore
function updateJobGroups(jobId, groups) {
    if (!jobId) {
        console.error("No job ID provided");
        return Promise.reject(new Error("No job ID provided"));
    }
    
    return db.collection(SPORTS_JOBS_COLLECTION).doc(jobId).update({
        groupImages: groups,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("Groups updated successfully");
        
        // Re-render groups
        renderGroups(groups);
        
        // Show success message
        showToast("Success", "Groups updated successfully");
        
        // Update the job in allJobs for search functionality
        const jobIndex = allJobs.findIndex(job => job.id === jobId);
        if (jobIndex !== -1) {
            allJobs[jobIndex].groupImages = groups;
        }
        
        return Promise.resolve();
    })
    .catch((error) => {
        console.error("Error updating groups:", error);
        showToast("Error", "Failed to update groups: " + error.message, "error");
        return Promise.reject(error);
    });
}

// Setup Export Functions
function setupExportFunctions() {
    console.log("Setting up export functions");
    
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (!exportDataBtn) {
        console.log("Export data button not found");
        return;
    }
    
    exportDataBtn.addEventListener('click', function() {
        // Get export options
        const exportRoster = document.getElementById('exportRoster').checked;
        const exportGroups = document.getElementById('exportGroups').checked;
        const exportFormat = document.getElementById('exportFormat').value;
        
        if (!exportRoster && !exportGroups) {
            alert('Please select at least one data type to export');
            return;
        }
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Add roster sheet if selected
        if (exportRoster && rosterData.length > 0) {
            // Convert roster data to worksheet
            const rosterWs = XLSX.utils.json_to_sheet(rosterData.map(entry => {
                return {
                    'Name': entry.lastName || '',
                    'Subject ID': entry.firstName || '',
                    'Special': entry.teacher || '',
                    'Sport/Team': entry.group || '',
                    'Email': entry.email || '',
                    'Phone': entry.phone || '',
                    'Images': entry.imageNumbers || '',
                    'Notes': entry.notes || ''
                };
            }));
            
            // Add roster worksheet to workbook
            XLSX.utils.book_append_sheet(wb, rosterWs, 'Athletes Roster');
        }
        
        // Add groups sheet if selected
        if (exportGroups && groupsData.length > 0) {
            // Convert groups data to worksheet
            const groupsWs = XLSX.utils.json_to_sheet(groupsData.map(group => {
                return {
                    'Description': group.description || '',
                    'Image Numbers': group.imageNumbers || '',
                    'Notes': group.notes || ''
                };
            }));
            
            // Add groups worksheet to workbook
            XLSX.utils.book_append_sheet(wb, groupsWs, 'Group Images');
        }
        
        try {
            // Get job details for filename
            db.collection(SPORTS_JOBS_COLLECTION).doc(currentJobID).get()
                .then(doc => {
                    if (doc.exists) {
                        const job = doc.data();
                        
                        // Format filename as "School Name Season/Type date"
                        const schoolName = job.schoolName || '';
                        const seasonType = job.seasonType || job.sportName || '';
                        
                        // Format date as MM-DD-YY
                        const date = job.shootDate && job.shootDate.toDate ? job.shootDate.toDate() : new Date(job.shootDate);
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const day = date.getDate().toString().padStart(2, '0');
                        const year = date.getFullYear().toString().slice(-2);
                        const dateStr = `${month}-${day}-${year}`;
                        
                        // Create filename: "School Name Season/Type MM-DD-YY"
                        const fileName = `${schoolName} ${seasonType} ${dateStr}`;
                        
                        // Export workbook
                        if (exportFormat === 'xlsx') {
                            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
                            saveAs(new Blob([s2ab(wbout)], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
                        } else {
                            const rosterCsv = exportRoster && rosterData.length > 0 ? XLSX.utils.sheet_to_csv(wb.Sheets['Athletes Roster']) : '';
                            saveAs(new Blob([rosterCsv], { type: 'text/csv' }), `${fileName}-roster.csv`);
                            
                            if (exportGroups && groupsData.length > 0) {
                                const groupsCsv = XLSX.utils.sheet_to_csv(wb.Sheets['Group Images']);
                                saveAs(new Blob([groupsCsv], { type: 'text/csv' }), `${fileName}-groups.csv`);
                            }
                        }
                        
                        // Show success message
                        showToast("Success", "Data exported successfully");
                    } else {
                        console.error("Job not found");
                        alert('Error exporting data: Job not found');
                    }
                })
                .catch(error => {
                    console.error("Error fetching job details:", error);
                    alert('Error exporting data: ' + error.message);
                });
        } catch (error) {
            console.error("Error exporting data:", error);
            alert('Error exporting data: ' + error.message);
        }
    });
    
    // Helper function to convert string to arraybuffer for XLSX export
    function s2ab(s) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) {
            view[i] = s.charCodeAt(i) & 0xFF;
        }
        return buf;
    }
}

// Setup Modal Backdrop Fix
function setupModalBackdropFix() {
    // Fix for multiple backdrops issue
    document.addEventListener('hidden.bs.modal', function() {
        // Short delay to ensure Bootstrap has time to process
        setTimeout(cleanupModalBackdrops, 100);
    });
}

// Clean up multiple modal backdrops
function cleanupModalBackdrops() {
    // Remove any extra backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    
    // If multiple backdrops exist, remove all but the last one
    if (backdrops.length > 1) {
        for (let i = 0; i < backdrops.length - 1; i++) {
            backdrops[i].remove();
        }
    }
    
    // If no modal is open, remove all backdrops
    const openModals = document.querySelectorAll('.modal.show');
    if (openModals.length === 0 && backdrops.length > 0) {
        backdrops.forEach(backdrop => backdrop.remove());
        
        // Also re-enable body scrolling if needed
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
    }
}

// Load school names from dropdownData collection
function loadSchoolNames() {
    console.log("Loading school names from dropdownData collection");
    
    const schoolNameSelect = document.getElementById('schoolName');
    if (!schoolNameSelect) {
        console.log("School name select element not found");
        return;
    }
    
    // Clear existing options except the first one (placeholder)
    while (schoolNameSelect.options.length > 1) {
        schoolNameSelect.remove(1);
    }
    
    // Query the dropdownData collection
    db.collection(DROPDOWN_DATA_COLLECTION)
        .orderBy("value", "asc")
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                console.log("No dropdown data found");
                return;
            }
            
            // Add each school as an option
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.value) {
                    const option = document.createElement('option');
                    option.value = data.value;
                    option.textContent = data.value;
                    schoolNameSelect.appendChild(option);
                }
            });
            
            console.log(`Loaded ${querySnapshot.size} school names`);
        })
        .catch((error) => {
            console.error("Error loading school names:", error);
            showToast("Warning", "Failed to load school names: " + error.message, "warning");
        });
}

// Calculate school year for a given date
function getSchoolYear(date) {
    const shootDate = date && date.toDate ? date.toDate() : new Date(date);
    const month = shootDate.getMonth(); // 0-11
    const year = shootDate.getFullYear();
    
    // School year starts in August (month 7)
    // If month is August-December, it's the start of the school year
    // If month is January-May, it's the end of the previous school year
    if (month >= 7) { // August to December
        return `${year}-${(year + 1).toString().slice(-2)}`;
    } else { // January to May
        return `${year - 1}-${year.toString().slice(-2)}`;
    }
}

// Get year for league jobs
function getLeagueYear(date) {
    const shootDate = date && date.toDate ? date.toDate() : new Date(date);
    return shootDate.getFullYear().toString();
}

// Create a folder card element
function createFolderCard(name, count, clickHandler) {
    const folderCard = document.createElement('div');
    folderCard.className = 'col-6 col-md-4 col-lg-3 folder-card-container';
    folderCard.innerHTML = `
        <div class="folder-card">
            <div class="folder-icon">
                <i class="bi bi-folder-fill"></i>
            </div>
            <div class="folder-info">
                <h5 class="folder-name">${name}</h5>
                <p class="folder-count">${count} ${count === 1 ? 'item' : 'items'}</p>
            </div>
        </div>
    `;
    
    folderCard.addEventListener('click', clickHandler);
    return folderCard;
}

// Update breadcrumb navigation
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('folderBreadcrumb');
    if (!breadcrumb) return;
    
    breadcrumb.innerHTML = '';
    
    // Always show "All Schools" as root
    const rootItem = document.createElement('li');
    rootItem.className = 'breadcrumb-item';
    if (currentFolderView.level === 'root') {
        rootItem.innerHTML = 'All Schools';
        rootItem.classList.add('active');
    } else {
        rootItem.innerHTML = '<a href="#" data-folder-level="root">All Schools</a>';
    }
    breadcrumb.appendChild(rootItem);
    
    // Show school if selected
    if (currentFolderView.school) {
        const schoolItem = document.createElement('li');
        schoolItem.className = 'breadcrumb-item';
        if (currentFolderView.level === 'school' && !currentFolderView.year) {
            schoolItem.innerHTML = currentFolderView.school;
            schoolItem.classList.add('active');
        } else {
            schoolItem.innerHTML = `<a href="#" data-folder-level="school" data-school="${currentFolderView.school}">${currentFolderView.school}</a>`;
        }
        breadcrumb.appendChild(schoolItem);
    }
    
    // Show year if selected
    if (currentFolderView.year) {
        const yearItem = document.createElement('li');
        yearItem.className = 'breadcrumb-item active';
        yearItem.innerHTML = currentFolderView.year;
        breadcrumb.appendChild(yearItem);
    }
    
    // Add click handlers to breadcrumb links
    breadcrumb.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const level = this.getAttribute('data-folder-level');
            const school = this.getAttribute('data-school');
            
            if (level === 'root') {
                currentFolderView = { level: 'root', school: null, year: null };
            } else if (level === 'school') {
                currentFolderView = { level: 'school', school: school, year: null };
            }
            
            displayArchivedJobsWithFolders();
        });
    });
}

// Setup table sorting
function setupTableSorting() {
    const sortableHeaders = document.querySelectorAll('.roster-table th.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const field = this.getAttribute('data-sort');
            let direction = this.getAttribute('data-sort-dir') || 'asc';
            
            // Toggle direction if already sorted by this field
            if (direction === 'asc') {
                direction = 'desc';
            } else {
                direction = 'asc';
            }
            
            // Remove sort indicators from all headers
            sortableHeaders.forEach(h => {
                h.removeAttribute('data-sort-dir');
                h.querySelector('.sort-icon').className = 'sort-icon bi';
            });
            
            // Set sort indicator for current header
            this.setAttribute('data-sort-dir', direction);
            this.querySelector('.sort-icon').className = `sort-icon bi ${direction === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'}`;
            
            // Sort roster data
            sortRosterEntries(rosterData, field, direction);
            
            // Re-render roster
            displayRoster(rosterData);
        });
    });
}

// Toggle job archive status
function toggleJobArchiveStatus(jobId, shouldArchive) {
    console.log(`Toggling job archive status: ${jobId}, shouldArchive: ${shouldArchive}`);
    
    if (!jobId) return;
    
    const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
    if (toggleArchiveBtn) {
        // Disable button to prevent multiple clicks
        toggleArchiveBtn.disabled = true;
        toggleArchiveBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ${shouldArchive ? 'Archiving...' : 'Activating...'}
        `;
    }
    
    // Update the archive status in Firestore
    db.collection(SPORTS_JOBS_COLLECTION).doc(jobId).update({
        isArchived: shouldArchive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log(`Job ${shouldArchive ? 'archived' : 'activated'} successfully`);
        
        // Close modal
        const viewJobModal = document.getElementById('viewJobModal');
        if (viewJobModal) {
            const bsViewJobModal = bootstrap.Modal.getInstance(viewJobModal);
            if (bsViewJobModal) {
                bsViewJobModal.hide();
            }
        }
        
        // Reload jobs in the appropriate tab
        if (shouldArchive) {
            loadJobs(false); // Reload active jobs
            
            // Show success toast
            showToast("Success", "Job marked as completed and moved to the Completed Jobs tab");
            
            // Switch to the completed jobs tab
            const completedJobsTab = document.getElementById('completed-jobs-tab');
            if (completedJobsTab) {
                const bsTab = new bootstrap.Tab(completedJobsTab);
                bsTab.show();
            }
        } else {
            loadArchivedJobs(); // Reload archived jobs
            
            // Show success toast
            showToast("Success", "Job marked as active and moved to the Active Jobs tab");
            
            // Switch to the active jobs tab
            const activeJobsTab = document.getElementById('active-jobs-tab');
            if (activeJobsTab) {
                const bsTab = new bootstrap.Tab(activeJobsTab);
                bsTab.show();
            }
        }
    })
    .catch((error) => {
        console.error(`Error ${shouldArchive ? 'archiving' : 'activating'} job:`, error);
        showToast("Error", `Failed to ${shouldArchive ? 'archive' : 'activate'} job: ${error.message}`, "error");
        
        // Re-enable button and reset text
        if (toggleArchiveBtn) {
            toggleArchiveBtn.disabled = false;
            toggleArchiveBtn.innerHTML = `
                <i class="bi bi-check-circle"></i> 
                <span id="archiveButtonText">${shouldArchive ? 'Mark as Completed' : 'Mark as Active'}</span>
            `;
        }
    });
}