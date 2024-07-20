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
        const durationInputs = document.querySelectorAll('#flowTable input[type="number"]');
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

// UI update functions
function updateRowNumbers() {
    const table = document.getElementById("flowTable");
    Array.from(table.rows).slice(1).forEach((row, index) => {
        row.cells[0].innerHTML = index + 1;
        row.cells[3].children[0].setAttribute("onchange", `updateFlowDuration(${index + 1})`);
    });
}

function updateFlowDuration() {
   
        const totalDuration = editingFlow.calculateTotalDuration();
        document.getElementById('flowTime').textContent = `${totalDuration} seconds`;
}

function updateAsanaDisplay(asana) {
    document.getElementById("currentAsana").innerHTML = `<h1>${asana.name}</h1>`;
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

    row.innerHTML = `
        <td>${index}</td>
        <td><button onclick="reorderPose(this)">Reorder</button></td>
        <td>${asana.name}</td>
        <td><input type="number" value="3" onchange="updateFlowDuration()"/></td>
        <td>${createSideDropdown(asana.side)}</td>
        <td><button onclick="removePose(this)">Remove</button></td>
    `;

    if (!editingFlow) {
        editingFlow = new Flow();
    }
    editingFlow.addAsana(asana);
    updateFlowDuration();
}

function createSideDropdown(side) {
    if (side === "Center") {
        return '<select><option value="Center" selected>Center</option></select>';
    }
    return '<select><option value="Right">Right</option><option value="Left">Left</option></select>';
}

function removePose(button) {
    const row = button.parentNode.parentNode;
    const table = document.getElementById("flowTable");
    const rowIndex = row.rowIndex;

    table.deleteRow(rowIndex);
    editingFlow.asanas.splice(rowIndex - 1, 1);
    updateRowNumbers();
    updateFlowDuration();
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

    // Update asana durations from input fields
    const durationInputs = document.querySelectorAll('#flowTable input[type="number"]');
    durationInputs.forEach((input, index) => {
        editingFlow.asanas[index].duration = parseInt(input.value) || 0;
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
            <th>Reorder</th>
            <th>Asana</th>
            <th>Duration</th>
            <th>Side</th>
            <th>Remove</th>
        </tr>
    `;

    editingFlow.asanas.forEach((asana, index) => {
        const row = table.insertRow(-1);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><button onclick="reorderPose(this)">Reorder</button></td>
            <td>${asana.name}</td>
            <td><input type="number" value="${asana.duration}" onchange="updateFlowDuration()"/></td>
            <td>${createSideDropdown(asana.side)}</td>
            <td><button onclick="removePose(this)">Remove</button></td>
        `;
    });

    updateFlowDuration();
}

function clearBuildAFlow() {
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('flowTime').textContent = '0 seconds';
    document.getElementById('flowTable').innerHTML = `
        <tr>
            <th>Number</th>
            <th>Reorder</th>
            <th>Asana</th>
            <th>Duration</th>
            <th>Side</th>
            <th>Remove</th>
        </tr>
    `;
    editingFlow = new Flow();
    editMode = false;
}

function playFlow(flowID) {
    changeScreen('flowScreen');
    const flows = getFlows();
    const flow = flows.find(f => f.flowID === flowID);
    let currentAsanaIndex = 0;

    function performAsana() {
        if (currentAsanaIndex < flow.asanas.length) {
            const asana = flow.asanas[currentAsanaIndex];
            updateCountdownTimer(asana.duration, asana.name, () => {
                currentAsanaIndex++;
                performAsana();
            });
        } else {
            endFlow();
        }
    }

    performAsana();
}

function updateCountdownTimer(duration, asanaName, callback) {
    const countdownElement = document.getElementById('countdown');
    const countdownCircle = document.getElementById('countdown-circle');
    const currentAsanaElement = document.getElementById("currentAsana");
    const circumference = 2 * Math.PI * 45; // 45 is the radius of the circle
    let remainingTime = duration;
    let lastUpdateTime = Date.now();

    countdownCircle.style.strokeDasharray = circumference;
    countdownCircle.style.strokeDashoffset = 0;
    
    currentAsanaElement.innerHTML = `<h2>${asanaName}</h2>`;
    countdownElement.innerText = displayFlowDuration(remainingTime);

    function update() {
        const now = Date.now();
        const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
        lastUpdateTime = now;

        remainingTime -= deltaTime;

        if (remainingTime <= 0) {
            countdownElement.innerText = '';
            countdownCircle.style.strokeDashoffset = circumference;
            callback();
            return;
        }

        const percentage = (1 - (remainingTime / duration)) * 100;
        const offset = circumference - (percentage / 100) * circumference;
        countdownCircle.style.strokeDashoffset = offset;

        countdownElement.innerText = displayFlowDuration(Math.ceil(remainingTime));

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}


function endFlow() {
    const countdownElement = document.getElementById('countdown');
    const countdownCircle = document.getElementById('countdown-circle');
    const currentAsanaElement = document.getElementById("currentAsana");

    countdownElement.innerText = '';
    countdownCircle.style.strokeDashoffset = 2 * Math.PI * 45;
    currentAsanaElement.innerHTML = `
        <h2>Flow Complete!</h2>
        <button onclick="changeScreen('homeScreen')" class="home-btn">Return Home</button>
    `;
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
        button.onclick = () => selectAsana(asana);
        asanaList.appendChild(button);
    });
}

// Initialize the app
async function initializeApp() {
    await loadAsanasFromXML();
    displayFlows();
    updateDate();
}

// Start the app
window.onload = initializeApp;

// Expose necessary functions to the global scope for HTML event handlers
window.selectAsana = selectAsana;
window.removePose = removePose;
window.saveFlow = saveFlow;
window.playFlow = playFlow;
window.editFlow = editFlow;
window.deleteFlow = deleteFlow;
window.changeScreen = changeScreen;
window.clearBuildAFlow = clearBuildAFlow;