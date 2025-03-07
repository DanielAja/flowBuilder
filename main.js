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
        this.duration = 3; // Default duration of 3 seconds
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
        <td title="Drag to reorder">${index}</td>
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
    
    // Add specific drag handle tooltip
    const numCell = row.cells[0];
    numCell.style.cursor = "grab";

    const newAsana = new YogaAsana(
        asana.name,
        asana.side,
        asana.image,
        asana.description,
        asana.difficulty,
        [...asana.tags || []],
        [...asana.transitionsAsana || []]
    );
    newAsana.setDuration(3); // Default 3 seconds
    
    editingFlow.addAsana(newAsana);
    updateFlowDuration();
    
    console.log(`Added asana: ${asana.name} to the flow. Current asanas:`, editingFlow.asanas);
    
    // Refresh the asana list to update recommended poses based on the last added pose
    populateAsanaList();
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
    // Check for empty values and set to 3 seconds
    const durationInputs = document.querySelectorAll('#flowTable .duration-wrapper input[type="number"]');
    durationInputs.forEach(input => {
        if (input.value === '' || parseInt(input.value) === 0) {
            input.value = 3;
        }
    });

    // Update durations in the flow object
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        if (index < editingFlow.asanas.length) {
            const durationInput = row.querySelector('.duration-wrapper input[type="number"]');
            if (durationInput) {
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 3;
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
    
    // Refresh the asana list to update recommended poses
    populateAsanaList();
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
                editingFlow.asanas[index].duration = parseInt(durationInput.value) || 3;
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
                    <button class="edit-btn" onclick="editFlow('${flow.flowID}')"></button>
                    <button class="delete-btn" onclick="deleteFlow('${flow.flowID}')"></button>
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
    
    // Make sure the asanas are proper objects
    if (editingFlow.asanas && Array.isArray(editingFlow.asanas)) {
        editingFlow.asanas = editingFlow.asanas.map(asana => {
            // Make sure each asana is a proper YogaAsana object
            if (!(asana instanceof YogaAsana)) {
                const newAsana = new YogaAsana(
                    asana.name, 
                    asana.side, 
                    asana.image,
                    asana.description,
                    asana.difficulty,
                    asana.tags || [],
                    asana.transitionsAsana || []
                );
                newAsana.setDuration(asana.duration || 3);
                return newAsana;
            }
            return asana;
        });
    }
    
    // Set edit mode
    editMode = true;
    
    // Switch to build screen
    changeScreen('buildScreen');
    
    // Update form fields with flow data
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    
    if (titleInput) titleInput.value = editingFlow.name || '';
    if (descriptionInput) descriptionInput.value = editingFlow.description || '';
    
    // Use the rebuildFlowTable function to populate the table
    rebuildFlowTable();
    
    console.log('Editing flow:', editingFlow.name, 'with', editingFlow.asanas.length, 'asanas');
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

// Main function to load asanas from XML
async function loadAsanasFromXML() {
    try {
        console.log("Loading asanas...");
        
        // Hard-code some sample asanas since XML loading might be causing issues
        asanas = [
            new YogaAsana(
                "Downward Facing Dog",
                "Center",
                "images/downward-facing-dog.png",
                "Downward Facing Dog is a standing pose that tones the legs and arms, while stretching them. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Stretch"],
                ["Plank", "Cobra"]
            ),
            new YogaAsana(
                "Tree Pose",
                "Right",
                "images/tree-pose.png",
                "Tree Pose is a standing pose that improves balance and concentration. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Balance"],
                ["Mountain Pose", "Warrior 3"]
            ),
            new YogaAsana(
                "Warrior 2",
                "Right",
                "images/warrior-2.png",
                "Warrior 2 is a standing pose that strengthens the legs and opens the hips. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Strength"],
                ["Mountain Pose", "Triangle Pose"]
            ),
            new YogaAsana(
                "Triangle Pose",
                "Right",
                "images/triangle-pose.png",
                "Triangle Pose is a standing pose that stretches the legs and opens the hips. It is a great pose for beginners.",
                "Beginner",
                ["Standing", "Stretch"],
                ["Warrior 2", "Half Moon Pose"]
            )
        ];
        
        console.log('Asanas loaded:', asanas);
        populateAsanaList();
        
    } catch (error) {
        console.error('Error loading asanas:', error);
        asanas = [];
    }
}

// Function to get recommended poses based on the last pose in the flow
function getRecommendedPoses() {
    if (!editingFlow || !editingFlow.asanas || editingFlow.asanas.length === 0) {
        return [];
    }
    
    const lastAsana = editingFlow.asanas[editingFlow.asanas.length - 1];
    if (!lastAsana || !lastAsana.transitionsAsana) {
        return [];
    }
    
    // Get transition asana names
    const transitionNames = lastAsana.transitionsAsana;
    
    // Find matching asanas
    const matches = asanas.filter(asana => 
        transitionNames.includes(asana.name)
    );
    
    // Return only one recommendation (the first match)
    return matches.length > 0 ? [matches[0]] : [];
}

// Populate the asana list with loaded asanas
function populateAsanaList() {
    console.log('Populating asana list with asanas:', asanas.length);
    
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
    
    // Check if we have recommended poses
    const recommendedPoses = getRecommendedPoses();
    const hasRecommendations = recommendedPoses.length > 0;
    
    // If we have recommendations, add animation but don't reposition
    if (hasRecommendations) {
        // Wait for elements to be created before animating
        setTimeout(() => {
            // Add a brief animation to the recommended pose
            const recommendedEl = document.querySelector('.asana-item.recommended');
            if (recommendedEl) {
                // Scroll to make the recommendation visible
                const recoBounds = recommendedEl.getBoundingClientRect();
                const containerBounds = asanaList.getBoundingClientRect();
                
                // Only scroll if the recommended pose is not fully visible
                if (recoBounds.left < containerBounds.left || recoBounds.right > containerBounds.right) {
                    recommendedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
                
                // Highlight it
                recommendedEl.classList.add('highlight');
                setTimeout(() => recommendedEl.classList.remove('highlight'), 1500);
            }
        }, 100);
    }
    
    // Use original order - don't reorder poses
    let posesList = [...asanas];
    
    posesList.forEach((asana, index) => {
        const asanaElement = document.createElement('div');
        asanaElement.className = 'asana-item';
        
        // Add recommended class if this is a recommended pose
        if (recommendedPoses.some(reco => reco.name === asana.name)) {
            asanaElement.classList.add('recommended');
        }
        
        asanaElement.draggable = true;
        asanaElement.setAttribute('data-name', asana.name);
        
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
        
        // Add event listener for click
        asanaElement.addEventListener('click', function() {
            selectAsana(asana);
        });
        
        // Add to list
        asanaList.appendChild(asanaElement);
    });
    
    console.log('Asana list populated with', asanas.length, 'asanas');
    if (hasRecommendations) {
        console.log('Recommended poses:', recommendedPoses.map(p => p.name).join(', '));
    }
}

// Scrolling functions for the asana list
function scrollAsanaList(amount) {
    const asanaList = document.getElementById('asanaList');
    if (asanaList) {
        asanaList.scrollLeft += amount;
        updateScrollButtons();
    }
}

function updateScrollButtons() {
    const asanaList = document.getElementById('asanaList');
    const leftButton = document.querySelector('.scroll-btn.scroll-left');
    const rightButton = document.querySelector('.scroll-btn.scroll-right');
    
    if (!asanaList || !leftButton || !rightButton) return;
    
    // Show/hide left button based on scroll position
    leftButton.style.display = asanaList.scrollLeft > 0 ? 'block' : 'none';
    
    // Show/hide right button based on whether there's more content to scroll
    const hasMoreToScroll = asanaList.scrollLeft + asanaList.clientWidth < asanaList.scrollWidth;
    rightButton.style.display = hasMoreToScroll ? 'block' : 'none';
}

// Function to set up drag and drop functionality
function setupDragAndDrop() {
    console.log('Setting up drag and drop...');
    const flowTable = document.getElementById('flowTable');
    if (!flowTable) {
        console.error('Flow table not found for drag and drop setup');
        return;
    }
    
    // Rebind all drag-and-drop events
    // First remove any existing handlers to prevent duplicates
    flowTable.removeEventListener('dragstart', handleDragStart);
    flowTable.removeEventListener('dragenter', handleDragEnter);
    flowTable.removeEventListener('dragover', handleDragOver);
    flowTable.removeEventListener('dragleave', handleDragLeave);
    flowTable.removeEventListener('drop', handleDrop);
    flowTable.removeEventListener('dragend', handleDragEnd);
    
    // Now add fresh event listeners
    flowTable.addEventListener('dragstart', handleDragStart);
    flowTable.addEventListener('dragenter', handleDragEnter);
    flowTable.addEventListener('dragover', handleDragOver);
    flowTable.addEventListener('dragleave', handleDragLeave);
    flowTable.addEventListener('drop', handleDrop);
    flowTable.addEventListener('dragend', handleDragEnd);
    
    // Make sure all rows are properly draggable
    updateRowDragAttributes();
    
    console.log('Drag and drop setup complete');
}

// Ensures all rows have proper drag attributes
function updateRowDragAttributes() {
    const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
    rows.forEach((row, index) => {
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-index', index);
        
        // Make sure first cell is styled as drag handle
        const firstCell = row.cells[0];
        if (firstCell) {
            firstCell.style.cursor = 'grab';
            firstCell.setAttribute('title', 'Drag to reorder');
        }
    });
}

// Drag and drop event handlers
function handleDragStart(e) {
    // Find the row being dragged - either the target itself or its parent row
    let row = null;
    
    if (e.target.tagName === 'TR') {
        row = e.target;
    } else {
        row = e.target.closest('tr');
        
        // Only allow drag from the first cell (position number)
        const cell = e.target.closest('td');
        if (!cell || cell.cellIndex !== 0) {
            e.preventDefault();
            return false;
        }
    }
    
    if (!row || row.rowIndex === 0) {
        e.preventDefault();
        return false; // Ignore header row
    }
    
    console.log('Drag started on row:', row.rowIndex);
    dragSource = row;
    row.classList.add('dragging');
    
    // Set the drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.rowIndex);
    
    // Make a ghost image that's more visible
    const dragImage = row.cloneNode(true);
    dragImage.style.width = row.offsetWidth + 'px';
    dragImage.style.height = row.offsetHeight + 'px';
    dragImage.style.opacity = '0.7';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.backgroundColor = '#fff8f0';
    dragImage.style.border = '2px solid #ff8c00';
    document.body.appendChild(dragImage);
    
    // Use the custom drag image
    e.dataTransfer.setDragImage(dragImage, 20, 20);
    
    // Clean up the ghost after a short delay
    setTimeout(() => {
        document.body.removeChild(dragImage);
    }, 100);
}

function handleDragEnter(e) {
    // Ensure we're actually dragging something
    if (!dragSource) return;
    
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) return; // Ignore header row
    
    // Add visual feedback
    const allRows = Array.from(document.querySelectorAll('#flowTable tr:not(:first-child)'));
    allRows.forEach(r => r.classList.remove('drop-target'));
    
    if (row !== dragSource) {
        row.classList.add('drop-target');
    }
}

function handleDragOver(e) {
    if (!dragSource) return;
    
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    
    // Find the closest row
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) return; // Ignore header row
    
    // Add visual feedback to the row being hovered over
    const allRows = Array.from(document.querySelectorAll('#flowTable tr:not(:first-child)'));
    allRows.forEach(r => {
        if (r !== dragSource) {
            r.classList.remove('drop-target');
        }
    });
    
    if (row !== dragSource) {
        row.classList.add('drop-target');
    }
}

function handleDragLeave(e) {
    // Only remove the class if we're leaving the row entirely, not just moving between cells
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.target.contains(relatedTarget)) {
        const row = e.target.closest('tr');
        if (row) {
            row.classList.remove('drop-target');
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    // Check if we have a valid drag source
    if (!dragSource) {
        console.log('No valid drag source');
        return;
    }
    
    const row = e.target.closest('tr');
    if (!row || row.rowIndex === 0) {
        console.log('Invalid drop target (header or not a row)');
        return; // Ignore header row
    }
    
    console.log('Drop target row:', row.rowIndex);
    
    // Get source and target indices
    const sourceIndex = dragSource.rowIndex - 1; // Adjust for header row
    const targetIndex = row.rowIndex - 1; // Adjust for header row
    
    if (sourceIndex === targetIndex) {
        console.log('Source and target are the same, no action needed');
        return;
    }
    
    console.log('Moving asana from', sourceIndex, 'to', targetIndex);
    
    try {
        // Update the asanas array
        const movedAsana = editingFlow.asanas.splice(sourceIndex, 1)[0];
        editingFlow.asanas.splice(targetIndex, 0, movedAsana);
        
        // Rebuild the table
        rebuildFlowTable();
        
        // Ensure draggable attributes are set again
        setTimeout(updateRowDragAttributes, 0);
        
        // Add highlight animation to the moved row
        setTimeout(() => {
            const rows = document.querySelectorAll('#flowTable tr:not(:first-child)');
            const targetRow = rows[targetIndex];
            if (targetRow) {
                targetRow.classList.add('drag-highlight');
                setTimeout(() => {
                    targetRow.classList.remove('drag-highlight');
                }, 1500);
            }
        }, 50);
        
        // Auto-save if in edit mode
        if (editMode) {
            autoSaveFlow();
        }
        
        // Refresh the recommended poses based on the new last pose
        populateAsanaList();
    } catch (error) {
        console.error('Error during drag and drop operation:', error);
    }
    
    // Clean up
    document.querySelectorAll('#flowTable tr').forEach(row => {
        row.classList.remove('drop-target');
    });
}

function handleDragEnd(e) {
    // Remove all drag styling
    document.querySelectorAll('#flowTable tr').forEach(row => {
        row.classList.remove('dragging', 'drop-target');
    });
    
    // Clear the drag source
    console.log('Drag operation ended');
    dragSource = null;
    
    // Re-setup drag and drop to ensure everything is bound correctly
    setTimeout(updateRowDragAttributes, 50);
}

function rebuildFlowTable() {
    const table = document.getElementById('flowTable');
    if (!table) return;
    
    // Clear the table except for the header
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    
    // Rebuild rows from editingFlow.asanas
    editingFlow.asanas.forEach((asana, index) => {
        if (!asana) return;
        
        const imgTransform = asana.side === "Left" ? "transform: scaleX(-1);" : "";
        
        const row = table.insertRow(-1);
        // Make the row element draggable for the drag event system to work
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-index', index);
        
        row.innerHTML = `
            <td title="Drag to reorder">${index + 1}</td>
            <td>
                <div class="table-asana">
                    <img src="${asana.image}" alt="${asana.name}" class="table-asana-img" style="${imgTransform}">
                    <span>${asana.name}</span>
                </div>
            </td>
            <td>
                <div class="duration-wrapper">
                    <input type="number" value="${asana.duration || 3}" min="1" max="300" onchange="updateFlowDuration()"/>
                    <span class="duration-unit">s</span>
                </div>
            </td>
            <td>${createSideDropdown(asana.side)}</td>
            <td><button class="table-btn remove-btn" onclick="removePose(this)">×</button></td>
        `;
        
        // Add specific drag handle tooltip and style
        const numCell = row.cells[0];
        numCell.style.cursor = "grab";
    });
    
    // Make sure drag and drop works after rebuild by updating all row attributes
    updateRowDragAttributes();
    
    // Set up drag handlers again to ensure they work after rebuilding
    setupDragAndDrop();
    
    // Update flow duration
    updateFlowDuration();
    
    console.log('Rebuilt flow table with draggable rows');
}

// Initialize the app
function initializeApp() {
    loadAsanasFromXML()
        .then(() => {
            displayFlows();
            updateDate();
            
            // Set up drag and drop
            setupDragAndDrop();
            
            // Add window resize listener for scroll buttons
            window.addEventListener('resize', updateScrollButtons);
            
            console.log('App initialized successfully');
        })
        .catch(error => {
            console.error('Failed to initialize app:', error);
        });
}

// Add event listener to initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);