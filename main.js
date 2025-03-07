// Utility functions
function generateUniqueID() {
    return Math.random().toString(36).substr(2, 9);
}

function getFlows() {
    const flows = localStorage.getItem('flows');
    return flows ? JSON.parse(flows) : [];
}

function saveFlows(flows) {
    localStorage.setItem('flows', JSON.stringify(flows));
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
        this.duration = 0;
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
        const durationInputs = document.querySelectorAll('#flowTable .duration-wrapper input[type="number"]');
        this.time = Array.from(durationInputs).reduce((sum, input) => sum + (parseInt(input.value) || 0), 0);
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

// UI update functions
function updateRowNumbers() {
    const table = document.getElementById("flowTable");
    Array.from(table.rows).slice(1).forEach((row, index) => {
        row.cells[0].innerHTML = index + 1;
        row.cells[3].children[0].setAttribute("onchange", `updateFlowDuration(${index + 1})`);
        
        // Add drag attributes for every row
        row.setAttribute("draggable", "true");
        row.setAttribute("data-index", index);
    });
}

function updateFlowDuration() {
    // Check for empty values and set to 3 seconds
    const durationInputs = document.querySelectorAll('#flowTable .duration-wrapper input[type="number"]');
    durationInputs.forEach(input => {
        if (input.value === '' || parseInt(input.value) === 0) {
            input.value = 3;
        }
    });

    const totalDuration = editingFlow.calculateTotalDuration();
    document.getElementById('flowTime').textContent = `${totalDuration} seconds`;
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
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
            nextAsanaImageElement.src = "path/to/end-of-flow-image.png"; // Replace with actual path
            nextAsanaImageElement.alt = "End of flow";
        }
    }
    if (comingUpSection) comingUpSection.style.display = "block";

    console.log('Current Asana:', asana.name, 'Image:', asana.image);
    console.log('Next Asana:', nextAsana ? nextAsana.name : 'End of flow', 'Image:', nextAsana ? nextAsana.image : 'End of flow image');

    return asana.duration;
}

// Screen management
function changeScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    currentScreenId = screenId;

    if (screenId === 'homeScreen') {
        displayFlows();
    } else if (screenId === 'buildScreen' && !editMode) {
        clearBuildAFlow();
    }
}

// Flow management
function selectAsana(asana) {
    const table = document.getElementById("flowTable");
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
                <input type="number" value="3" min="1" max="300" onchange="updateFlowDuration()"/>
                <span class="duration-unit">s</span>
            </div>
        </td>
        <td>${createSideDropdown(asana.side)}</td>
        <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
    `;
    
    // Make the row draggable
    row.setAttribute("draggable", "true");
    row.setAttribute("data-index", index - 1); // Adjust index for 0-based array

    const newAsana = { ...asana, duration: 3 }; // Create a new object with duration
    editingFlow.addAsana(newAsana);
    updateFlowDuration();
}

// This function is replaced by the updated createSideDropdown function below


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

// Function to automatically save flow changes
function autoSaveFlow() {
    // Get current values from form
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    
    // Require at least a title
    if (!title || editingFlow.asanas.length === 0) {
        return; // Don't auto-save if no title or no asanas
    }
    
    // Update flow properties
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
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 3; // Default to 3
                editingFlow.asanas[index].side = sideSelect.value;
            }
        }
    });
    
    // Get existing flows
    const flows = getFlows();
    
    // Find and update existing flow
    const flowIndex = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
    if (flowIndex !== -1) {
        flows[flowIndex] = editingFlow;
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
        document.querySelector('.build-content').appendChild(indicator);
    }
    
    // Show the indicator
    indicator.classList.add('visible');
    
    // Hide the indicator after a delay
    setTimeout(() => {
        indicator.classList.remove('visible');
    }, 1500);
}

function removePose(button) {
    const row = button.parentNode.parentNode;
    const table = document.getElementById("flowTable");
    const rowIndex = row.rowIndex;

    table.deleteRow(rowIndex);
    editingFlow.asanas.splice(rowIndex - 1, 1);
    updateRowNumbers();
    updateFlowDuration();
    
    // Auto-save if in edit mode (will be triggered by updateFlowDuration)
}

function saveFlow() {
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;

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
        const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
        const sideSelect = row.querySelector('select.side-select');
        
        editingFlow.asanas[index].duration = parseInt(durationInput.value) || 0;
        editingFlow.asanas[index].side = sideSelect.value;
    });

    const flows = getFlows();
    
    if (editMode) {
        // Update existing flow
        const index = flows.findIndex(flow => flow.flowID === editingFlow.flowID);
        if (index !== -1) {
            flows[index] = editingFlow;
        } else {
            console.error('Flow not found for editing');
            return;
        }
    } else {
        // Add new flow
        flows.push(editingFlow);
    }

    saveFlows(flows);
    displayFlows();
    changeScreen('homeScreen');
    
    // Reset editing state
    editingFlow = null;
    editMode = false;
}

function displayFlows() {
    const flows = getFlows();
    const flowList = document.getElementById('savedFlowsList');
    flowList.innerHTML = '';

    flows.forEach(flow => {
        const flowItem = document.createElement('div');
        flowItem.className = 'flow-item';
        flowItem.innerHTML = `
            <div class="flow-info">
                <h4>${flow.name}</h4>
                <p class="flow-description">(${displayFlowDuration(flow.time)}) ${flow.description}</p>
            </div>
            <div class="flow-actions">
                <button class="flow-btn" onclick="playFlow('${flow.flowID}')">FLOW</button>
                <button class="edit-btn" onclick="editFlow('${flow.flowID}')"></button>
                <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')"></button>
            </div>
        `;
        flowList.appendChild(flowItem);
    });

    // Update flow count
    const flowCount = document.querySelector('.flow-count');
    flowCount.textContent = `${flows.length} flow${flows.length !== 1 ? 's' : ''}`;
}

function deleteFlow(flowID) {
    let flows = getFlows();
    flows = flows.filter(flow => flow.flowID !== flowID);
    saveFlows(flows);
    displayFlows();
}

// This function is no longer used since we've removed the reorder buttons
// We're keeping it as a placeholder since it might be referenced elsewhere
function reorderPose(element) {
    // Functionality now handled by drag and drop
}

function editFlow(flowID) {
    changeScreen('buildScreen');
    const flows = getFlows();
    editingFlow = Object.assign(new Flow(), flows.find(flow => flow.flowID === flowID));
    editMode = true;

    document.getElementById('title').value = editingFlow.name;
    document.getElementById('description').value = editingFlow.description;

    const table = document.getElementById('flowTable');
    table.innerHTML = `
        <tr>
            <th>Number</th>
            <th>Asana</th>
            <th>Duration</th>
            <th>Side</th>
            <th>Remove</th>
        </tr>
    `;

    editingFlow.asanas.forEach((asana, index) => {
        // Create initial transform style based on side
        const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
        
        const row = table.insertRow(-1);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div class="table-asana">
                    <img src="${asana.image}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}">
                    <span>${asana.name}</span>
                </div>
            </td>
            <td>
                <div class="duration-wrapper">
                    <input type="number" value="${asana.duration}" min="1" max="300" onchange="updateFlowDuration()"/>
                    <span class="duration-unit">s</span>
                </div>
            </td>
            <td>${createSideDropdown(asana.side)}</td>
            <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
        `;
        
        // Make the row draggable
        row.setAttribute("draggable", "true");
        row.setAttribute("data-index", index);
    });

    // Hide the save button and show auto-save message
    const buildActions = document.querySelector('.build-actions');
    if (buildActions) {
        const saveBtn = buildActions.querySelector('.save-flow-btn');
        if (saveBtn) {
            saveBtn.style.display = 'none';
        }
        
        // Add auto-save message if not present
        if (!document.getElementById('auto-save-message')) {
            const autoSaveMsg = document.createElement('div');
            autoSaveMsg.id = 'auto-save-message';
            autoSaveMsg.textContent = 'Changes save automatically';
            autoSaveMsg.className = 'auto-save-message';
            buildActions.appendChild(autoSaveMsg);
        }
    }

    updateFlowDuration();
}


function clearBuildAFlow() {
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('flowTime').textContent = '0 seconds';
    document.getElementById('flowTable').innerHTML = `
        <tr>
            <th>Number</th>
            <th>Asana</th>
            <th>Duration</th>
            <th>Side</th>
            <th>Remove</th>
        </tr>
    `;
    editingFlow = new Flow();
    editMode = false;
    
    // Show the save button again and remove auto-save message
    const buildActions = document.querySelector('.build-actions');
    if (buildActions) {
        const saveBtn = buildActions.querySelector('.save-flow-btn');
        if (saveBtn) {
            saveBtn.style.display = 'inline-block';
        }
        
        // Remove auto-save message if present
        const autoSaveMsg = document.getElementById('auto-save-message');
        if (autoSaveMsg) {
            autoSaveMsg.remove();
        }
    }
    
    // Update scroll buttons visibility after clearing
    setTimeout(updateScrollButtons, 100);
}

let animationFrameId;

function playFlow(flowID) {
    paused = false;
    changeScreen('flowScreen');
    const flows = getFlows();
    editingFlow = flows.find(f => f.flowID === flowID);
    currentAsanaIndex = 0;
  
    // Reset the display of elements that might have been hidden/changed
    const pauseButton = document.querySelector('.pause-btn');
    if (pauseButton) {
        pauseButton.style.display = 'inline-block';
        pauseButton.disabled = false;
        pauseButton.style.opacity = '1';
    }
    
    const asanaImageContainer = document.querySelector('.asana-image-container');
    if (asanaImageContainer) {
        asanaImageContainer.innerHTML = `<img id="asanaImage" src="" alt="Asana pose" />`;
    }
  
    performAsana();
}

function performAsana() {
    if (currentAsanaIndex < editingFlow.asanas.length) {
        const asana = editingFlow.asanas[currentAsanaIndex];
        const duration = updateAsanaDisplay(asana);
        updateCountdownTimer(duration, asana.name, () => {
            currentAsanaIndex++;
            performAsana();
        });
    } else {
        endFlow();
    }
}
var paused = false;
var lastUpdateTime;
function updateCountdownTimer(duration, asanaName, callback) {
    const countdownElement = document.getElementById('countdown');
    const countdownCircle = document.getElementById('countdown-circle');
    const asanaNameElement = document.getElementById("asanaName");
    const circumference = 2 * Math.PI * 45; // 45 is the radius of the circle
    let remainingTime = duration;
    lastUpdateTime = Date.now();

    // Reset the circle and countdown at the start of each asana
    countdownCircle.style.strokeDasharray = circumference;
    countdownCircle.style.strokeDashoffset = 0;
    
    if (asanaNameElement) {
        asanaNameElement.textContent = asanaName;
    }
    countdownElement.innerText = displayFlowDuration(remainingTime);

    // Cancel any existing animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    function update() {
        if (!paused) {
            const now = Date.now();
            const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
            lastUpdateTime = now;
            remainingTime -= deltaTime;

            if (remainingTime <= 0) {
                countdownElement.innerText = '';
                countdownCircle.style.strokeDashoffset = circumference;
                cancelAnimationFrame(animationFrameId);
                callback();
                return;
            }

            const percentage = (1 - (remainingTime / duration)) * 100;
            const offset = circumference - (percentage / 100) * circumference;
            countdownCircle.style.strokeDashoffset = offset;
            countdownElement.innerText = displayFlowDuration(Math.ceil(remainingTime));
        }
        animationFrameId = requestAnimationFrame(update);
    }

    animationFrameId = requestAnimationFrame(update);
}

function togglePause() {
    const pauseButton = document.querySelector('.pause-btn');
    paused = !paused;
    if (paused) {
        pauseButton.textContent = "▶️";
        pauseButton.title = "Resume";
        
    } else {
        pauseButton.textContent = "⏸️";
        lastUpdateTime = Date.now();
        pauseButton.title = "Pause";
    }
}

function endFlow() {
    const asanaImageContainer = document.querySelector('.asana-image-container');
    const countdownContainer = document.querySelector('.countdown-container');
    const comingUpSection = document.querySelector('.coming-up');
    
    // Clear the countdown text and reset the circle
    const countdownElement = document.getElementById('countdown');
    const countdownCircle = document.getElementById('countdown-circle');
    if (countdownElement) countdownElement.innerText = '';
    if (countdownCircle) countdownCircle.style.strokeDashoffset = 0;
    
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // Keep the pause button visible but disable it
    const pauseButton = document.querySelector('.pause-btn');
    if (pauseButton) {
        pauseButton.disabled = true;
        pauseButton.style.opacity = '0.5';
    }
    
    // Clear and update the asana image container
    if (asanaImageContainer) {
        asanaImageContainer.innerHTML = `
            <button class="home-btn" onclick="changeScreen('homeScreen')">Return Home</button>
        `;
    }
    
    // Keep the countdown container and coming up section visible
    if (countdownContainer) countdownContainer.style.display = 'block';
    if (comingUpSection) comingUpSection.style.display = 'block';
    
    // Update the coming up section to show "End of flow"
    const nextAsanaNameElement = document.getElementById("nextAsanaName");
    const nextAsanaImageElement = document.getElementById("nextAsanaImage");
    if (nextAsanaNameElement) nextAsanaNameElement.textContent = "End of flow";
    if (nextAsanaImageElement) {
        nextAsanaImageElement.src = "path/to/end-of-flow-image.png"; // Replace with actual path
        nextAsanaImageElement.alt = "End of flow";
    }
}

function updateDate() {
    const dateElement = document.querySelector('.flow-date h3');
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const today = new Date();
    dateElement.textContent = `Today, ${today.toLocaleDateString('en-US', options)}`;
}

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

// Function to fetch and parse the XML file
async function fetchAndParseXML(url) {
    const response = await fetch(url);
    const xmlString = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
}

// Function to create a YogaAsana object from an XML element
function createYogaAsanaFromXML(asanaElement) {
    const name = asanaElement.querySelector('name').textContent;
    const side = asanaElement.querySelector('side').textContent;
    const image = asanaElement.querySelector('image').textContent;
    const description = asanaElement.querySelector('description').textContent;
    const difficulty = asanaElement.querySelector('difficulty').textContent;
    const tags = Array.from(asanaElement.querySelectorAll('tags tag')).map(tag => tag.textContent);
    const transitions = Array.from(asanaElement.querySelectorAll('transitions transition')).map(transition => transition.textContent);

    return new YogaAsana(name, side, image, description, difficulty, tags, transitions);
}

// Main function to load asanas from XML
async function loadAsanasFromXML() {
    try {
        const xmlDoc = await fetchAndParseXML('asanas.xml');
        const asanaElements = xmlDoc.querySelectorAll('asana');
        
        asanas = Array.from(asanaElements).map(createYogaAsanaFromXML);
        
        console.log('Asanas loaded:', asanas);
        populateAsanaList();
    } catch (error) {
        console.error('Error loading asanas:', error);
        asanas = [];
    }
}

// Populate asana list
function populateAsanaList() {
    const asanaList = document.getElementById('asanaList');
    asanaList.innerHTML = ''; // Clear existing asanas
    asanas.forEach(asana => {
        const button = document.createElement('button');
        button.textContent = asana.name;
        button.className = 'asana-btn';
        button.onclick = () => selectAsana(asana);
        
        // Create an image preview
        const img = document.createElement('img');
        img.src = asana.image;
        img.alt = asana.name;
        img.className = 'asana-preview';
        
        // Apply transform for left-side poses
        if (asana.side === "Left") {
            img.style.transform = 'scaleX(-1)';
        }
        
        // Create container for asana button
        const asanaContainer = document.createElement('div');
        asanaContainer.className = 'asana-container';
        asanaContainer.appendChild(img);
        asanaContainer.appendChild(button);
        
        asanaList.appendChild(asanaContainer);
    });
    
    // Update scroll buttons visibility after populating
    setTimeout(updateScrollButtons, 100);
}

// Drag and drop functions
function initDragAndDrop() {
    const flowTable = document.getElementById('flowTable');
    
    // Event delegation for drag events on the flow table
    flowTable.addEventListener('dragstart', handleDragStart);
    flowTable.addEventListener('dragover', handleDragOver);
    flowTable.addEventListener('dragleave', handleDragLeave);
    flowTable.addEventListener('drop', handleDrop);
    flowTable.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) return; // Ignore drag on header row
    
    dragSource = row;
    row.classList.add('dragging');
    
    // Set data transfer
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.index);
    
    // Set a custom drag image (optional)
    const dragImage = row.querySelector('.table-asana-img');
    if (dragImage) {
        e.dataTransfer.setDragImage(dragImage, 20, 20);
    }
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) return; // Don't allow dropping on header
    
    // Add visual feedback
    const allRows = Array.from(document.querySelectorAll('#flowTable tr:not(:first-child)'));
    allRows.forEach(r => r.classList.remove('drop-target'));
    
    row.classList.add('drop-target');
    e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(e) {
    const row = e.target.closest('tr');
    if (row) {
        row.classList.remove('drop-target');
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const dropTarget = e.target.closest('tr');
    if (!dropTarget || dropTarget.rowIndex === 0 || !dragSource) return;
    
    // Get source and target indices
    const sourceIndex = parseInt(dragSource.dataset.index);
    const targetIndex = parseInt(dropTarget.dataset.index);
    
    if (sourceIndex === targetIndex) return;
    
    // Update the asanas array in the editingFlow
    const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
    editingFlow.asanas.splice(targetIndex, 0, movedAsana);
    
    // Rebuild the table rows
    rebuildFlowTable();
    
    // Remove visual cues
    dropTarget.classList.remove('drop-target');
    
    // Auto-save if in edit mode
    if (editMode) {
        autoSaveFlow();
    }
}

function handleDragEnd() {
    // Clean up
    document.querySelectorAll('#flowTable tr').forEach(row => {
        row.classList.remove('dragging', 'drop-target');
    });
    dragSource = null;
}

function rebuildFlowTable() {
    const table = document.getElementById('flowTable');
    
    // Save the header row
    const headerRow = table.rows[0];
    
    // Clear the table except for the header
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    // Rebuild the table with the updated asanas array
    editingFlow.asanas.forEach((asana, index) => {
        // Create initial transform style based on side
        const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
        
        const row = table.insertRow(-1);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div class="table-asana">
                    <img src="${asana.image}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}">
                    <span>${asana.name}</span>
                </div>
            </td>
            <td>
                <div class="duration-wrapper">
                    <input type="number" value="${asana.duration}" min="1" max="300" onchange="updateFlowDuration(${index + 1})"/>
                    <span class="duration-unit">s</span>
                </div>
            </td>
            <td>${createSideDropdown(asana.side)}</td>
            <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
        `;
    });
    
    // Update row numbers and attributes
    updateRowNumbers();
}

// Initialize the app
async function initializeApp() {
    await loadAsanasFromXML();
    displayFlows();
    updateDate();
    initDragAndDrop();
    initScrollButtons();
    initAutoSaveListeners();
}

// Function to initialize the scroll buttons visibility and add scroll event listener
function initScrollButtons() {
    const asanaList = document.getElementById('asanaList');
    if (!asanaList) return;
    
    // Initial update of button visibility
    updateScrollButtons();
    
    // Add scroll event listener to update button visibility during scrolling
    asanaList.addEventListener('scroll', updateScrollButtons);
    
    // Also update on window resize in case container size changes
    window.addEventListener('resize', updateScrollButtons);
}

// Set up auto-save for form fields when in edit mode
function initAutoSaveListeners() {
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    
    titleInput.addEventListener('input', function() {
        if (editMode) {
            // Small delay to avoid saving while still typing
            clearTimeout(titleInput.saveTimeout);
            titleInput.saveTimeout = setTimeout(autoSaveFlow, 500);
        }
    });
    
    descriptionInput.addEventListener('input', function() {
        if (editMode) {
            // Small delay to avoid saving while still typing
            clearTimeout(descriptionInput.saveTimeout);
            descriptionInput.saveTimeout = setTimeout(autoSaveFlow, 500);
        }
    });
}

// Function to update scroll button visibility based on scroll position
function updateScrollButtons() {
    const asanaList = document.getElementById('asanaList');
    const leftBtn = document.querySelector('.scroll-left');
    const rightBtn = document.querySelector('.scroll-right');
    
    if (!asanaList || !leftBtn || !rightBtn) return;
    
    // Show/hide left button based on scroll position
    leftBtn.style.display = asanaList.scrollLeft > 10 ? 'flex' : 'none';
    
    // Show/hide right button based on whether there's more content to scroll
    const isScrollable = asanaList.scrollWidth > asanaList.clientWidth;
    const reachedEnd = Math.abs(asanaList.scrollWidth - asanaList.clientWidth - asanaList.scrollLeft) < 10;
    
    rightBtn.style.display = (isScrollable && !reachedEnd) ? 'flex' : 'none';
}

// Start the app
window.onload = initializeApp;

// Function to scroll the asana list horizontally
function scrollAsanaList(scrollAmount) {
    const asanaList = document.getElementById('asanaList');
    if (!asanaList) return;
    
    // Smooth scroll
    asanaList.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
}

// Expose necessary functions to the global scope for HTML event handlers
window.selectAsana = selectAsana;
window.removePose = removePose;
window.saveFlow = saveFlow;
window.playFlow = playFlow;
window.editFlow = editFlow;
window.deleteFlow = deleteFlow;
window.changeScreen = changeScreen;
window.clearBuildAFlow = clearBuildAFlow;
window.reorderPose = reorderPose;
window.updateAsanaImageOrientation = updateAsanaImageOrientation;
window.scrollAsanaList = scrollAsanaList;