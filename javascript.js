//class for yogaAsana
class YogaAsana {
    constructor(name, side, image, description, difficulty, tags, transitionsAsana) {
        this.name = name;
        this.image = image;
        this.description = description;
        this.difficulty = difficulty;
        this.tags = tags;
        this.transitionsAsana = transitionsAsana;
        this.side = side;
        this.duration = 0;
    }
    setDuriation(duration) {
        this.duration = duration;
    }

    setSide(side) {
      this.side = side;
  }
};

//Class for Flow
class Flow {
    constructor(name, description, time, peakPose) {
        this.name = name;
        this.description = description;
        this.time = time;
        this.peakPose = peakPose;
        this.asanas = [];
        this.flowID = generateUniqueID();
    }

    calculateTotalDuration() {
      let sum = 0;
      for (let i = 0; i < this.asanas.length; i++) {
        const asana = this.asanas[i];
        const duration = parseInt(asana.duration, 10);
        if (!isNaN(duration)) {
          sum += duration;
          asanas[i].duration = duration;
        }
      }
      this.time = sum;
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

function calculateTotalDuration(flow) {
  let sum = 0;
  for (let i = 0; i < flow.asanas.length; i++) {
    const asana = flow.asanas[i];
    const duration = parseInt(asana.duration, 10);
    if (!isNaN(duration)) {
      sum += duration;
      asanas[i].duration = duration;
    }
  }
  flow.time = sum;
  return flow.time;
}

window.onload = function() {
    // Load the asanas
    getFlows();
    // Load the flows
    displayFlows();
}

function updateRowNumbers() {
    var table = document.getElementById("flowTable");
    var rows = table.rows;
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var numberCell = row.cells[0];
      numberCell.innerHTML = i;

      var durationInput = row.cells[3].children[0];
      durationInput.setAttribute("onchange", "updateFlowDuration(" + i + ")");
    }
  }

editingFlow = new Flow();
        function selectAsana(asana) {
          var table = document.getElementById("flowTable");
          var row = table.insertRow(-1);
          var numberCell = row.insertCell(0);
          var reorderCell = row.insertCell(1);
          var asanaCell = row.insertCell(2);
          var durationCell = row.insertCell(3);
          var sideCell = row.insertCell(4);
          var removeCell = row.insertCell(5);

          var index = table.rows.length - 1
          numberCell.innerHTML =
            "<span class='row-number'>" + (index) + "</span>";

          reorderCell.innerHTML =
            "<button onclick='reorderPose(this)'>Reorder</button>";
          asanaCell.innerHTML = asana.name;
          durationCell.innerHTML =
            "<input type='number' id='durationInput' placeholder='Duration' value='3' onchange='updateFlowDuration("+index+")'/>";
            
            let sideDropdown = '';
            if (asana.side === "Center") {
              sideDropdown = `
                <select>
                  <option value="Center" selected>Center</option>
                </select>
              `;
            } else {
              sideDropdown = `
                <select>
                <option value="Right">Right</option>
                  <option value="Left">Left</option>
                </select>
              `;
            }

            sideCell.innerHTML = sideDropdown;

          removeCell.innerHTML =
            "<button onclick='removePose(this)'>Remove</button>";
            
            editingFlow.asanas.push(asana);
            updateFlowDuration(index);
        }

        function updateRowNumbers() {
          var table = document.getElementById("flowTable");
          var rows = table.rows;
        
          for (var i = 1; i < rows.length; i++) {
            var row = rows[i];
            var numberCell = row.cells[0];
            numberCell.innerHTML = i;
        
            var durationInput = row.cells[3].children[0];
            durationInput.setAttribute("onchange", "updateFlowDuration(" + i + ")");
          }
        }


  function removePose(button) {
    var row = button.parentNode.parentNode;
    var table = document.getElementById("flowTable");
    var rowIndex = row.rowIndex;
  
    // Remove the row from the table
    table.deleteRow(rowIndex);
  
    // Remove the asana from the editingFlow object
    editingFlow.asanas.splice(rowIndex - 1, 1);
  
    // Update the row numbers
    updateRowNumbers();
  
    // Update the flow duration
    updateFlowDuration();
  }

  let currentScreenId = 'homeScreen';

  function changeScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
  
    currentScreenId = screenId;
  
    if (screenId === 'homeScreen') {
      console.log('Displaying home screen...');
      displayFlows();
    }
  
    if (screenId === 'buildScreen') {
      if (!editMode) {
        console.log('Clearing build a flow...');
        clearBuildAFlow();
        console.log(editingFlow);
        appendFlow(editingFlow);
      }
    }
  
    const targetScreen = document.getElementById(screenId);
    targetScreen.classList.add('active');
  }

  editMode=false;

  function saveFlow() {
    flow = editingFlow;
    flow.name = document.getElementById('title').value;
    flow.description = document.getElementById('description').value;
    // flow.peakPose = document.getElementById('peakPose').value;
  
    // Retrieve the values entered in the title
    const title = document.getElementById('title').value;
  
    // Iterate over the rows in the flowTable and extract the asana name and duration for each row
    const flowTable = document.getElementById('flowTable');
    const rows = flowTable.getElementsByTagName('tr');
  
    //if there are no flows, or there is no title
    if (flow.asanas.length === 0) {
      alert('Please add asanas to the flow before saving');
      return;
    }
    if (!title) {
      alert('Please enter a title for the flow before saving');
      return;
    }
  
    // for (let i = 1; i < rows.length; i++) {
    //   asanaDuration = parseInt(rows[i].cells[3].children[0].value);
    //   console.log(asanaDuration);
    //   console.log(flow);
    //   flow.asanas[i - 1].setDuriation(asanaDuration);
    // }
    console.log(editingFlow);
    if (editMode) {
      flow.time = calculateTotalDuration(flow);
    } else {
      flow.calculateTotalDuration();
    }
  
    // Get the existing flows from local storage or create an empty array
    const flows = getFlows();
  
    //if flowID already exists, update the flow
    let flowIndex = -1;
    for (i = 0; i < flows.length; i++) {
      if (flows[i].flowID === flow.flowID) {
        flowIndex = i;
        break;
      }
    }
  
    if (flowIndex !== -1) {
      // Update the existing flow
      flows[flowIndex] = flow;
    } else {
      // Add the new flow to the array
      flows.push(flow);
    }
  
    localStorage.setItem('flows', JSON.stringify(flows));
    console.log('Flow saved successfully');
    console.log(flow);
    editingFlow = flow;
  
    // Refresh the display of flows
    displayFlows();
  }

let flows = Array();
//get saved flows from local storage
// function getFlows() {
//   if (flows.length <= 0){
//       var flows_ = localStorage.getItem('flows');
//       if (flows_) {
//           flows = JSON.parse(flows_);
//       }
//   }
//   return flows;
// }
function getFlows() {
  var flows_ = localStorage.getItem('flows');
  if (flows_) {
    return JSON.parse(flows_);
  } else {
    return [];
  }
}

  function appendFlow(flow) {
    flows.push(flow);
    var flows_ = JSON.stringify(flows);
    localStorage.setItem('flow', JSON.stringify(flows_));
  }


//display saved flows
function displayFlows() {
  flows = getFlows();
  flowList = document.getElementById('savedFlowsList');

  // Clear existing flow list
  flowList.innerHTML = '';

  for (var i = 0; i < flows.length; i++) {
    flow = flows[i];
    const listItem = document.createElement('tr');
    listItem.innerHTML = `
      <td>${flow.name}</td>
      <td>${flow.description}</td>
      <td>${flow.time}</td>
      <td><button onclick="playFlow('${flow.flowID}')">View Details</button></td>
      <td><button onclick="editFlow('${flow.flowID}')">Edit Flow</button></td>
      <td><button onclick="deleteFlow('${flow.flowID}')">Delete Flow</button></td>
    `;
    flowList.appendChild(listItem);
  }
  console.log('Flows displayed successfully');
  console.log(flows);

  // Repopulate the table if the current screen is 'homeScreen'
  if (currentScreenId === 'homeScreen') {
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
  }
}

//function to view flow details
function viewFlowDetails(flowName) {
    // Retrieve the flow from local storage
    const flows = getFlows();
    const flow = flows.find(flow => flow.name === flowName);

    // Display the flow details
    alert(`Flow Name: ${flow.name}\nDescription: ${flow.description}\nTime: ${flow.time}\nPeak Pose: ${flow.peakPose}`);
}

function deleteFlow(flowID) {
  // clearFlows();
  // Retrieve the flows from local storage
  let flows = getFlows();

  // Find the index of the flow to be deleted
  let flowIndex = -1;
  for (let i = 0; i < flows.length; i++) {
    if (flows[i].flowID === flowID) {
      flowIndex = i;
      break;
    }
  }

  if (flowIndex !== -1) {
    // Remove the flow from the array
    flows.splice(flowIndex, 1);

    // Update the flows in local storage
    localStorage.setItem('flows', JSON.stringify(flows));

    // Remove the corresponding row from the table
    displayFlows();

   
    console.log('Flow deleted successfully');
    console.log(getFlows());
  }
}

function clearFlows() {
  localStorage.removeItem('flows');
  console.log('Flows cleared successfully');
}

// Function to view the details of a flow
function viewFlowDetails(flow) {
  // Implement your logic to view the details of a flow here
  // console.log("Viewing details of flow:", flow);
}


function getFlow(flows_, flowID) {
    // Retrieve the flows from local storage
    // const flows_ = getFlows();
    for (let i = 0; i < flows_.length; i++) {
        if (flows_[i].flowID == flowID) {
            
            return i;
        }
        // console.log(i);
        //     console.log(flows[i].flowID);
        //     console.log(flowID)
    }
    return -1;
  }

  function playFlow(flowID) {
    const d = new Date();
  
    flows_ = getFlows();
    changeScreen('flowScreen');
    console.log("Playing flow:");
    let flowIndex = getFlow(flows_, flowID);
  
    console.log(flowIndex + " : " + flowID);
    let asanas_ = flows_[flowIndex].asanas;
    console.log(flows_[flowIndex]);
  
    let currentAsanaIndex = 0;
    let updateTime = d.getTime();
    console.log(updateTime);
  
   // Recursive function to perform asanas sequentially
  function performAsana() {
    if (currentAsanaIndex < asanas_.length) {
      let asana_ = asanas_[currentAsanaIndex];
      console.log(flows_);
      console.log(`Performing asana:`);
      console.log(asana_);
      updateAsanaDisplay(asana_);

      // Update the countdown timer
      updateCountdownTimer(asana_.duration);

      currentAsanaIndex++;

      // Wait for the specified duration before performing the next asana
      setTimeout(performAsana, asana_.duration * 1000);
    } else {
      // All asanas have been performed
      viewFlowDetails(flows[flowIndex]);
      endFlow();
    }
  }

    // Function to update the countdown timer
  function updateCountdownTimer(duration) {
    let countdownElement = document.getElementById('countdown');
    let remainingTime = duration;

    countdownElement.innerText = remainingTime;

    let countdownInterval = setInterval(() => {
      remainingTime--;
      if (remainingTime!=0) countdownElement.innerText = remainingTime;

      if (remainingTime <= 1) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }
  
    // Start performing asanas
    performAsana();
  }

function updateAsanaDisplay(asana) {
   
    console.log("Updating display...");
    document.getElementById("currentAsana").innerHTML = 
    '<h1>' + asana.name + '</h1>';
    return asana.duration;

}

function endFlow() {
  let countdownElement = document.getElementById('countdown');

    countdownElement.innerText = '';

    console.log("Flow completed");
    document.getElementById("currentAsana").innerHTML = 
    '<h1> End of Flow </h1>' +
    '<button onclick="changeScreen(\'homeScreen\')">Go Back</button>';
   
}

function generateUniqueID()
{
    return Math.random().toString(36).substr(2, 9);
}

function updateFlowDuration(rowIndex) {
  const durationInput = document.getElementById('flowTable').rows[rowIndex].cells[3].children[0];
  const duration = parseInt(durationInput.value, 10);

  if (!isNaN(duration)) {
    const asanaIndex = rowIndex - 1; // Subtract 1 to account for the header row
    if (asanaIndex >= 0 && asanaIndex < editingFlow.asanas.length) {
      editingFlow.asanas[asanaIndex].duration = duration;
      console.log('Updating flow duration...');
      console.log(editingFlow);
      document.getElementById('flowTime').textContent = editingFlow.calculateTotalDuration() + ' seconds';
    }
  }
}

function updateFlowDuration() {
  const table = document.getElementById('flowTable');
  const rows = table.rows;
  let totalDuration = 0;

  for (let i = 1; i < rows.length; i++) {
    const durationInput = rows[i].cells[3].children[0];
    const duration = parseInt(durationInput.value, 10);

    if (!isNaN(duration)) {
      const asanaIndex = i - 1; // Subtract 1 to account for the header row
      if (asanaIndex >= 0 && asanaIndex < editingFlow.asanas.length) {
        editingFlow.asanas[asanaIndex].duration = duration;
        totalDuration += duration;
      }
    }
  }

  console.log('Updating flow duration...');
  console.log(editingFlow);
  document.getElementById('flowTime').textContent = totalDuration + ' seconds';
}

function editFlow(flowID) {
  changeScreen('buildScreen');

  var flows_ = getFlows();
  flowIndex = getFlow(flows_, flowID);
  editingFlow = flows_[flowIndex];
  editMode = true;

  document.getElementById('title').value = editingFlow.name;
  document.getElementById('description').value = editingFlow.description;
  // document.getElementById('peakPose').value = editingFlow.peakPose;

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

  let sideDropdown = '';
    

  for (let i = 0; i < editingFlow.asanas.length; i++) {
    const asana = editingFlow.asanas[i];
    const row = table.insertRow(-1);
    let sideDropdown = '';
    if (asana.side === "Center") {
      sideDropdown = `
        <select>
          <option value="Center" selected>Center</option>
        </select>
      `;
    } else {
      sideDropdown = `
        <select>
        <option value="Right">Right</option>
          <option value="Left">Left</option>
        
        </select>
      `;
    }
    row.innerHTML = `
      <td><span class="row-number">${i + 1}</span></td>
      <td><button onclick="reorderPose(this)">Reorder</button></td>
      <td>${asana.name}</td>
      <td><input type="number" value="${asana.duration}" onchange="updateFlowDuration()"/></td>`
      +sideDropdown+
     

      `<td><button onclick="removePose(this)">Remove</button></td>
    `;
  }

  updateFlowDuration();
}


function calculateTotalDuration(flow)
{
  let sum = 0;
  for (let i = 0; i < flow.asanas.length; i++) {
    const asana = flow.asanas[i];
    const duration = parseInt(asana.duration, 10);
    if (!isNaN(duration)) {
      sum += duration;
      asanas[i].duration = duration;
    }
  }
  flow.time = sum;
  return sum;
}

function clearBuildAFlow()
{
  console.log('Clearing build a flow...');``
  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
  document.getElementById('flowTime').textContent = '0 seconds';
  // document.getElementById('peakPose').value = '';
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
  // editingFlow = new Flow();
  editMode = false;
}
