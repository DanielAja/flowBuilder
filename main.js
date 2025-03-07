// Utility functions
function generateUniqueID() {
    try {
        return Math.random().toString(36).substr(2, 9);
    } catch (error) {
        console.error('Error generating unique ID:', error);
        return Date.now().toString(36); // Fallback
    }
}

function getFlows() {
    try {
        const flowsJson = localStorage.getItem('flows');
        console.log('Raw flow data from localStorage:', flowsJson);
        
        if (!flowsJson) {
            console.log('No flows found in localStorage');
            return [];
        }
        
        const flows = JSON.parse(flowsJson);
        console.log('Parsed flows:', flows);
        
        if (!Array.isArray(flows)) {
            console.error('Flows is not an array:', flows);
            return [];
        }
        
        return flows;
    } catch (error) {
        console.error('Error getting flows from localStorage:', error);
        return [];
    }
}

function saveFlows(flows) {
    try {
        if (!Array.isArray(flows)) {
            console.error('Cannot save flows: not an array', flows);
            return;
        }
        
        const flowsJson = JSON.stringify(flows);
        localStorage.setItem('flows', flowsJson);
        console.log('Saved flows to localStorage:', flowsJson);
    } catch (error) {
        console.error('Error saving flows to localStorage:', error);
    }
}

// YogaAsana class definition
class YogaAsana {
    constructor(name, side, image, description, difficulty, tags, transitionsAsana) {
        this.name = name;
        this.side = side;
        this.image = image;
        this.description = description;
        this.difficulty = difficulty;
        this.tags = tags;
        this.transitionsAsana = transitionsAsana;
        this.duration = 30; // Default duration of 30 seconds
    }

    setDuration(duration) {
        this.duration = duration;
    }

    setSide(side) {
        this.side = side;
    }
}

// Flow class definition
class Flow {
    constructor(name = '', description = '', time = 0, peakPose = '') {
        this.name = name;
        this.description = description;
        this.time = time;
        this.peakPose = peakPose;
        this.asanas = [];
        this.flowID = generateUniqueID();
    }

    calculateTotalDuration() {
        if (this.asanas.length === 0) {
            this.time = 0;
            return 0;
        }
        
        this.time = this.asanas.reduce((total, asana) => total + (asana.duration || 0), 0);
        return this.time;
    }

    addAsana(asana) {
        this.asanas.push(asana);
    }

    getAsana(name) {
        return this.asanas.find(asana => asana.name === name);
    }

    getAsanas() {
        return this.asanas;
    }
}

// Global variables
let editingFlow = new Flow();
let editMode = false;
let currentScreenId = 'homeScreen';
let asanas = [];
let dragSource = null;
let currentAsanaIndex = 0;
let isReversed = false;
let paused = false;
let lastUpdateTime = 0;
let animationFrameId = null;

function displayFlowDuration(duration) {
    duration = Math.max(0, Math.round(duration)); // Ensure non-negative integer
    let mins = Math.floor(duration / 60);
    let sec = duration % 60;
    let retString = "";
    let tmp = "";
    if (mins > 0)
        retString += mins.toString() + "min";
    if (sec > 0 || mins === 0)
        tmp = sec.toString().padStart(2, '0') + "s";
    return (retString + " " + tmp).trim();
}

function updateAsanaDisplay(asana) {
    const asanaNameElement = document.getElementById("asanaName");
    const asanaSideElement = document.getElementById("asanaSide");
    const asanaImageElement = document.getElementById("asanaImage");
    const nextAsanaNameElement = document.getElementById("nextAsanaName");
    const nextAsanaImageElement = document.getElementById("nextAsanaImage");
    const comingUpSection = document.querySelector(".coming-up");

    if (asanaNameElement) asanaNameElement.textContent = asana.name;
    if (asanaSideElement) asanaSideElement.textContent = asana.side;
    if (asanaImageElement) {
        asanaImageElement.src = asana.image;
        asanaImageElement.alt = `${asana.name} pose`;
        
        // Flip the image if the side is left
        if (asana.side.toLowerCase() === 'left') {
            asanaImageElement.style.transform = 'scaleX(-1)';
        } else {
            asanaImageElement.style.transform = 'scaleX(1)';
        }
    }
    
    // Update next asana info
    const nextAsana = editingFlow.asanas[currentAsanaIndex + 1];
    if (nextAsana) {
        if (nextAsanaNameElement) nextAsanaNameElement.textContent = nextAsana.name;
        if (nextAsanaImageElement) {
            nextAsanaImageElement.src = nextAsana.image;
            nextAsanaImageElement.alt = `${nextAsana.name} pose`;
        }
    } else {
        if (nextAsanaNameElement) nextAsanaNameElement.textContent = "End of flow";
        if (nextAsanaImageElement) {
            nextAsanaImageElement.src = "images/downward-facing-dog.png"; // Use a default image
            nextAsanaImageElement.alt = "End of flow";
        }
    }
    if (comingUpSection) comingUpSection.style.display = "block";

    console.log('Current Asana:', asana.name, 'Image:', asana.image);
    console.log('Next Asana:', nextAsana ? nextAsana.name : 'End of flow', 'Image:', nextAsana ? nextAsana.image : 'End of flow image');

    return asana.duration;
}

// Function to clear the build flow screen
function clearBuildAFlow() {
    // Reset form fields
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    
    // Clear flow table
    const table = document.getElementById('flowTable');
    if (table) {
        // Clear existing rows except header
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
    }
    
    // Reset flow duration
    const flowTime = document.getElementById('flowTime');
    if (flowTime) {
        flowTime.textContent = '0 seconds';
    }
    
    // Create a new flow
    editingFlow = new Flow();
    editMode = false;
}

// Screen management
function changeScreen(screenId) {
    console.log(`Changing screen to: ${screenId}`);
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    
    if (!targetScreen) {
        console.error(`Screen with ID ${screenId} not found`);
        return;
    }
    
    targetScreen.classList.add('active');
    currentScreenId = screenId;

    if (screenId === 'homeScreen') {
        displayFlows();
    } else if (screenId === 'buildScreen' && !editMode) {
        clearBuildAFlow();
    }
}

// Function to start a new flow from the home screen
function startNewFlow() {
    console.log('Starting new flow...');
    
    // Create a new flow object
    editingFlow = new Flow();
    editMode = false;
    
    // Switch to build screen
    console.log('Switching to build screen...');
    changeScreen('buildScreen');
    
    // Reset form fields after switching screen
    setTimeout(() => {
        console.log('Resetting form fields...');
        const titleInput = document.getElementById('title');
        const descriptionInput = document.getElementById('description');
        if (titleInput) {
            console.log('Found title input, clearing...');
            titleInput.value = '';
        } else {
            console.error('Title input not found');
        }
        
        if (descriptionInput) {
            console.log('Found description input, clearing...');
            descriptionInput.value = '';
        } else {
            console.error('Description input not found');
        }
        
        // Clear flow table
        const table = document.getElementById('flowTable');
        if (table) {
            console.log('Found flow table, clearing rows...');
            // Clear existing rows except header
            while (table.rows.length > 1) {
                table.deleteRow(1);
            }
        } else {
            console.error('Flow table not found');
        }
        
        // Reset flow duration
        const flowTime = document.getElementById('flowTime');
        if (flowTime) {
            console.log('Resetting flow duration display...');
            flowTime.textContent = '0 seconds';
        } else {
            console.error('Flow time element not found');
        }
    }, 100);
}

// Flow management
function selectAsana(asana) {
    const table = document.getElementById("flowTable");
    if (!table) {
        console.error("Flow table not found");
        return;
    }
    
    const row = table.insertRow(-1);
    const index = table.rows.length - 1;

    // Create initial transform style based on side
    const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";

    row.innerHTML = `
        <td>${index}</td>
        <td>
            <div class="table-asana">
                <img src="${asana.image}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}">
                <span>${asana.name}</span>
            </div>
        </td>
        <td>
            <div class="duration-wrapper">
                <input type="number" value="30" min="1" max="300" onchange="updateFlowDuration()"/>
                <span class="duration-unit">s</span>
            </div>
        </td>
        <td>${createSideDropdown(asana.side)}</td>
        <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
    `;
    
    // Make the row draggable
    row.setAttribute("draggable", "true");
    row.setAttribute("data-index", index - 1); // Adjust index for 0-based array

    const newAsana = new YogaAsana(
        asana.name,
        asana.side,
        asana.image,
        asana.description,
        asana.difficulty,
        [...asana.tags || []],
        [...asana.transitionsAsana || []]
    );
    newAsana.setDuration(30); // Default 30 seconds
    
    editingFlow.addAsana(newAsana);
    updateFlowDuration();
    
    console.log(`Added asana: ${asana.name} to the flow. Current asanas:`, editingFlow.asanas);
}

// Function to create a side dropdown menu
function createSideDropdown(side) {
    if (side === "Center") {
        return '<select class="side-select" onchange="updateAsanaImageOrientation(this)"><option value="Center" selected>Center</option></select>';
    }
    return `<select class="side-select" onchange="updateAsanaImageOrientation(this)">
        <option value="Right" ${side === "Right" ? "selected" : ""}>Right</option>
        <option value="Left" ${side === "Left" ? "selected" : ""}>Left</option>
    </select>`;
}

function updateAsanaImageOrientation(selectElement) {
    // Get the row containing this select element
    const row = selectElement.closest('tr');
    if (!row) return;
    
    // Find the image in this row
    const img = row.querySelector('.table-asana-img');
    if (!img) return;
    
    // Apply transform based on selected side
    if (selectElement.value === "Left") {
        img.style.transform = 'scaleX(-1)';
    } else {
        img.style.transform = 'scaleX(1)';
    }
    
    // Update the asana in the editingFlow
    const rowIndex = row.rowIndex - 1; // Adjust for header row
    if (editingFlow && editingFlow.asanas && editingFlow.asanas[rowIndex]) {
        editingFlow.asanas[rowIndex].side = selectElement.value;
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
    }
}

// UI update functions
function updateRowNumbers() {
    const table = document.getElementById("flowTable");
    if (!table) return;
    
    Array.from(table.rows).slice(1).forEach((row, index) => {
        row.cells[0].innerHTML = index + 1;
        
        // Add drag attributes for every row
        row.setAttribute("draggable", "true");
        row.setAttribute("data-index", index);
    });
}

function updateFlowDuration() {
    // Check for empty values and set to 30 seconds
    const durationInputs = document.querySelectorAll('#flowTable .duration-wrapper input[type="number"]');
    durationInputs.forEach(input => {
        if (input.value === '' || parseInt(input.value) === 0) {
            input.value = 30;
        }
    });

    // Update durations in the flow object
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        if (index < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            if (durationInput) {
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 30;
            }
        }
    });

    const totalDuration = editingFlow.calculateTotalDuration();
    const flowTime = document.getElementById('flowTime');
    if (flowTime) {
        flowTime.textContent = `${totalDuration} seconds`;
    }
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

// Function to automatically save flow changes
function autoSaveFlow() {
    // Get current values from form
    const title = document.getElementById('title')?.value;
    const description = document.getElementById('description')?.value;
    
    // Require at least a title
    if (!title || editingFlow.asanas.length === 0) {
        return; // Don't auto-save if no title or no asanas
    }
    
    // Update flow properties
    editingFlow.name = title;
    editingFlow.description = description;
    editingFlow.calculateTotalDuration();
    
    // Get existing flows
    const flows = getFlows();
    
    // Find and update existing flow
    const flowIndex = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
    if (flowIndex !== -1) {
        flows[flowIndex] = { ...editingFlow };
        saveFlows(flows);
        
        // Show a brief save indicator
        showSaveIndicator();
    }
}

// Show a brief "Saved" indicator
function showSaveIndicator() {
    // Check if indicator already exists
    let indicator = document.getElementById('save-indicator');
    
    if (!indicator) {
        // Create indicator if it doesn't exist
        indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.textContent = 'Changes saved';
        document.querySelector('.build-content')?.appendChild(indicator);
    }
    
    // Show the indicator
    indicator.classList.add('visible');
    
    // Hide the indicator after a delay
    setTimeout(() => {
        indicator.classList.remove('visible');
    }, 1500);
}

function removePose(button) {
    const row = button.closest('tr');
    if (!row) return;
    
    const table = document.getElementById("flowTable");
    if (!table) return;
    
    const rowIndex = row.rowIndex;
    
    // Remove from array
    editingFlow.asanas.splice(rowIndex - 1, 1);
    
    // Remove from UI
    table.deleteRow(rowIndex);
    
    // Update UI
    updateRowNumbers();
    updateFlowDuration();
}

function saveFlow() {
    const title = document.getElementById('title')?.value;
    const description = document.getElementById('description')?.value;

    if (!editingFlow) {
        editingFlow = new Flow();
    }

    if (editingFlow.asanas.length === 0) {
        alert('Please add asanas to the flow before saving');
        return;
    }
    if (!title) {
        alert('Please enter a title for the flow before saving');
        return;
    }

    editingFlow.name = title;
    editingFlow.description = description;
    editingFlow.calculateTotalDuration();

    // Update asana durations and sides from input fields
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        if (index < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            const sideSelect = row.querySelector('select.side-select');
            
            if (durationInput && sideSelect) {
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 30;
                editingFlow.asanas[index].side = sideSelect.value;
            }
        }
    });

    // Get existing flows from storage
    const flows = getFlows();
    console.log('Current flows before save:', flows);
    
    if (editMode) {
        // Update existing flow
        const index = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
        if (index !== -1) {
            flows[index] = { ...editingFlow };
            console.log('Updated flow at index', index);
        } else {
            console.error('Flow not found for editing');
            return;
        }
    } else {
        // Add new flow
        const flowToSave = { ...editingFlow };
        flows.push(flowToSave);
        console.log('Added new flow with ID:', flowToSave.flowID);
    }

    // Save flows back to storage
    saveFlows(flows);
    console.log('Saved flows:', flows);
    
    // Update UI
    displayFlows();
    changeScreen('homeScreen');
    
    // Reset editing state
    editingFlow = new Flow();
    editMode = false;
}

function displayFlows() {
    const flows = getFlows();
    console.log('Displaying flows:', flows); // Debug log
    
    const flowList = document.getElementById('savedFlowsList');
    
    if (!flowList) {
        console.error("Element with ID 'savedFlowsList' not found");
        return;
    }
    
    flowList.innerHTML = '';

    if (flows.length === 0) {
        console.log('No flows available');
        flowList.innerHTML = '<div class="empty-message">No flows available. Create your first flow!</div>';
    } else {
        console.log(`Adding ${flows.length} flows to the list`);
        flows.forEach(flow => {
            const flowItem = document.createElement('div');
            flowItem.className = 'flow-item';
            flowItem.innerHTML = `
                <div class="flow-info">
                    <h4>${flow.name}</h4>
                    <p class="flow-description">(${displayFlowDuration(flow.time)}) ${flow.description || ''}</p>
                </div>
                <div class="flow-actions">
                    <button class="flow-btn" onclick="playFlow('${flow.flowID}')">FLOW</button>
                    <button class="edit-btn" onclick="editFlow('${flow.flowID}')">Edit</button>
                    <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')">Delete</button>
                </div>
            `;
            flowList.appendChild(flowItem);
        });
    }

    // Update flow count
    const flowCount = document.querySelector('.flow-count');
    if (flowCount) {
        flowCount.textContent = `${flows.length} flow${flows.length !== 1 ? 's' : ''}`;
    }
}

function deleteFlow(flowID) {
    if (confirm('Are you sure you want to delete this flow?')) {
        let flows = getFlows();
        flows = flows.filter(flow => flow.flowID !== flowID);
        saveFlows(flows);
        displayFlows();
    }
}

function playFlow(flowID) {
    const flows = getFlows();
    const flowToPlay = flows.find(flow => flow.flowID === flowID);
    
    if (!flowToPlay) {
        console.error(`Flow with ID ${flowID} not found`);
        return;
    }
    
    // Set up the flow for practice
    editingFlow = new Flow();
    Object.assign(editingFlow, flowToPlay);
    currentAsanaIndex = 0;
    paused = false;
    
    // Initialize the practice screen
    changeScreen('flowScreen');
    
    // Start the flow if it has asanas
    if (editingFlow.asanas && editingFlow.asanas.length > 0) {
        const asana = editingFlow.asanas[currentAsanaIndex];
        const duration = updateAsanaDisplay(asana);
        
        // Set up the countdown timer
        startCountdownTimer(duration);
    }
}

function startCountdownTimer(duration) {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;
    
    let timeLeft = duration;
    countdownElement.textContent = displayFlowDuration(timeLeft);
    
    if (animationFrameId) {
        clearTimeout(animationFrameId);
    }
    
    const updateTimer = () => {
        if (!paused) {
            timeLeft -= 1;
            countdownElement.textContent = displayFlowDuration(timeLeft);
            
            if (timeLeft <= 0) {
                // Move to next asana
                currentAsanaIndex++;
                if (currentAsanaIndex < editingFlow.asanas.length) {
                    const nextAsana = editingFlow.asanas[currentAsanaIndex];
                    const nextDuration = updateAsanaDisplay(nextAsana);
                    timeLeft = nextDuration;
                } else {
                    // End of flow
                    countdownElement.textContent = 'End';
                    return;
                }
            }
        }
        
        animationFrameId = setTimeout(updateTimer, 1000);
    };
    
    animationFrameId = setTimeout(updateTimer, 1000);
}

function togglePause() {
    paused = !paused;
    const pauseBtn = document.querySelector('.pause-btn');
    if (pauseBtn) {
        pauseBtn.textContent = paused ? "▶️" : "⏸️";
    }
}

function editFlow(flowID) {
    const flows = getFlows();
    const flowToEdit = flows.find(flow => flow.flowID === flowID);
    
    if (!flowToEdit) {
        console.error(`Flow with ID ${flowID} not found`);
        return;
    }
    
    // Create a deep copy of the flow
    editingFlow = new Flow();
    Object.assign(editingFlow, flowToEdit);
    editMode = true;
    
    // Switch to build screen
    changeScreen('buildScreen');
    
    // Update form fields with flow data
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    
    if (titleInput) titleInput.value = editingFlow.name || '';
    if (descriptionInput) descriptionInput.value = editingFlow.description || '';
    
    // Clear and populate the flow table
    const table = document.getElementById('flowTable');
    if (table) {
        // Clear existing rows except header
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
        
        // Add rows for each asana
        if (editingFlow.asanas && editingFlow.asanas.length > 0) {
            editingFlow.asanas.forEach(asana => {
                if (!asana) return;
                
                // Create transform style based on side
                const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
                
                const row = table.insertRow(-1);
                row.innerHTML = `
                    <td></td> <!-- Will be updated by updateRowNumbers -->
                    <td>
                        <div class="table-asana">
                            <img src="${asana.image}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}">
                            <span>${asana.name}</span>
                        </div>
                    </td>
                    <td>
                        <div class="duration-wrapper">
                            <input type="number" value="${asana.duration || 30}" min="1" max="300" onchange="updateFlowDuration()"/>
                            <span class="duration-unit">s</span>
                        </div>
                    </td>
                    <td>${createSideDropdown(asana.side)}</td>
                    <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
                `;
            });
            
            // Update row numbers and flow duration
            updateRowNumbers();
            updateFlowDuration();
        }
    }
}

// Function to update the date display
function updateDate() {
    const dateElement = document.querySelector('.flow-date h3');
    if (dateElement) {
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        const today = new Date();
        dateElement.textContent = `Today, ${today.toLocaleDateString('en-US', options)}`;
    }
}

// XML Processing functions
async function fetchAndParseXML(url) {
    try {
        console.log(`Fetching XML from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load XML: ${response.status} ${response.statusText}`);
        }
        
        const xmlString = await response.text();
        console.log(`XML string length: ${xmlString.length}`);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        // Check for parsing errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            console.error('XML parsing error:', parseError.textContent);
            throw new Error('XML parsing error');
        }
        
        return xmlDoc;
    } catch (error) {
        console.error('Error in fetchAndParseXML:', error);
        throw error;
    }
}

// Main function to load asanas from XML
async function loadAsanasFromXML() {
    try {
        // Use the correct path to the XML file - the file is in the flowBuilder directory
        const xmlDoc = await fetchAndParseXML('./asanas.xml');
        
        // Debug the XML structure
        console.log('XML document loaded:', xmlDoc);
        
        const asanaElements = xmlDoc.getElementsByTagName('asana');
        console.log('Found asana elements:', asanaElements.length);
        
        asanas = [];
        for (let i = 0; i < asanaElements.length; i++) {
            // Log each asana element before processing
            console.log(`Processing asana element ${i}:`, asanaElements[i].outerHTML);
            
            try {
                // The XML uses <n> for name instead of <name>
                const nameElement = asanaElements[i].getElementsByTagName('n')[0];
                const sideElement = asanaElements[i].getElementsByTagName('side')[0];
                const imageElement = asanaElements[i].getElementsByTagName('image')[0];
                const descriptionElement = asanaElements[i].getElementsByTagName('description')[0];
                const difficultyElement = asanaElements[i].getElementsByTagName('difficulty')[0];
                
                if (!nameElement) {
                    console.error('Name element not found in XML:', asanaElements[i]);
                    continue;
                }
                
                const name = nameElement.textContent;
                const side = sideElement ? sideElement.textContent : 'Center';
                const image = imageElement ? imageElement.textContent : '';
                const description = descriptionElement ? descriptionElement.textContent : '';
                const difficulty = difficultyElement ? difficultyElement.textContent : 'Beginner';
                
                // Get tags if they exist
                const tags = [];
                const tagsElement = asanaElements[i].getElementsByTagName('tags')[0];
                if (tagsElement) {
                    const tagElements = tagsElement.getElementsByTagName('tag');
                    for (let j = 0; j < tagElements.length; j++) {
                        tags.push(tagElements[j].textContent);
                    }
                }
                
                // Get transitions if they exist
                const transitions = [];
                const transitionsElement = asanaElements[i].getElementsByTagName('transitions')[0];
                if (transitionsElement) {
                    const transitionElements = transitionsElement.getElementsByTagName('transition');
                    for (let j = 0; j < transitionElements.length; j++) {
                        transitions.push(transitionElements[j].textContent);
                    }
                }
        
                console.log(`Created asana: ${name} with transitions:`, transitions);
                const asana = new YogaAsana(name, side, image, description, difficulty, tags, transitions);
                asanas.push(asana);
            } catch (error) {
                console.error('Error creating asana from XML:', error, asanaElements[i]);
            }
        }
        
        console.log('Asanas loaded:', asanas);
        if (asanas.length === 0) {
            console.error('No asanas were loaded successfully');
        } else {
            populateAsanaList();
        }
    } catch (error) {
        console.error('Error loading asanas:', error);
        asanas = [];
    }
}

// Populate the asana list with loaded asanas
function populateAsanaList() {
    const asanaList = document.getElementById('asanaList');
    if (!asanaList) {
        console.error("Asana list element not found");
        return;
    }
    
    asanaList.innerHTML = '';
    
    // Show loading message if no asanas yet
    if (asanas.length === 0) {
        asanaList.innerHTML = '<div class="loading-message">Loading asanas...</div>';
        return;
    }
    
    // Create asana elements
    asanas.forEach(asana => {
        const asanaElement = document.createElement('div');
        asanaElement.className = 'asana-item';
        asanaElement.draggable = true;
        asanaElement.setAttribute('data-name', asana.name);
        
        // Add event listener for click
        asanaElement.addEventListener('click', () => selectAsana(asana));
        
        // Create image element
        const asanaImage = document.createElement('img');
        asanaImage.src = asana.image;
        asanaImage.alt = asana.name;
        
        // Create name label
        const asanaName = document.createElement('p');
        asanaName.textContent = asana.name;
        
        // Append elements
        asanaElement.appendChild(asanaImage);
        asanaElement.appendChild(asanaName);
        
        // Add to list
        asanaList.appendChild(asanaElement);
    });
}

// Initialize the app
function initializeApp() {
    loadAsanasFromXML()
        .then(() => {
            displayFlows();
            updateDate();
            
            console.log('App initialized successfully');
        })
        .catch(error => {
            console.error('Failed to initialize app:', error);
        });
}

// Add event listener to initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);