//class for yogaAsana
class YogaAsana {
    constructor(name, image, description, difficulty, tags, transitionsAsana) {
        this.name = name;
        this.image = image;
        this.description = description;
        this.difficulty = difficulty;
        this.tags = tags;
        this.transitionsAsana = transitionsAsana;
    }
}

//Class for Flow
class Flow {
    constructor(name, description, time, peakPose) {
        this.name = name;
        this.description = description;
        this.time = time;
        this.peakPose = peakPose;
        this.asanas = [];
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



function removePose(button) {
  var row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);
}

function changeScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    targetScreen.classList.add('active');
  }

