/**
 * Copyright reelyActive 2016
 * We believe in an open Internet of Things
 */


// Constant definitions
DEFAULT_SOCKET_URL = 'https://www.hyperlocalcontext.com/notman';
APPEARANCE_FLOOR_NOTES = [ 'C3', 'E3', 'G3', 'C4' ];
APPEARANCE_NOTE_DURATION = '16n';
DISPLACEMENT_FLOOR_NOTES = [ 'C2', 'E2', 'G2', 'C3' ];
DISPLACEMENT_NOTE_DURATION = '16n';
DISAPPEARANCE_FLOOR_NOTES = [ 'C2', 'E2', 'G2', 'C3' ];
DISAPPEARANCE_NOTE_DURATION = '16n';
FLOOR_VOLUME_MULTIPLIER = 8;
FLOOR_VOLUME_BASE = -20;


/**
 * dashboard Module
 * All of the JavaScript specific to the dashboard is contained inside this
 * angular module.  The only external dependencies are:
 * - beaver (reelyActive)
 * - socket.io (btford)
 */
angular.module('dashboard', ['btford.socket-io', 'reelyactive.beaver'])


/**
 * Socket Factory
 * Creates the websocket connection to the given URL using socket.io.
 */
.factory('Socket', function(socketFactory) {
  return socketFactory({
    ioSocket: io.connect(DEFAULT_SOCKET_URL)
  });
})


/**
 * DashCtrl Controller
 * Handles the manipulation of all variables accessed by the HTML view.
 */
.controller('DashCtrl', function($scope, Socket, beaver) {

  // Variables accessible in the HTML scope
  $scope.devices = beaver.getDevices();
  $scope.directories = beaver.getDirectories();
  $scope.stats = beaver.getStats();
  $scope.thirdFloorCounts = [ 0, 0, 0 ];
  $scope.secondFloorCounts = [ 0, 0, 0 ];
  $scope.firstFloorCounts = [ 0, 0, 0 ];
  $scope.cafeCount = 0;

  // beaver.js listens on the websocket for events
  beaver.listen(Socket);

  // Set up synths and counts
  var appearanceSynth = initialiseAppearanceSynths();
  var displacementSynth = initialiseDisplacementSynth();
  var floorOsc = initialiseFloorOscillators();
  var disappearanceSynth = initialiseDisappearanceSynths();
  var totalCount = 0;
  var floorCounts = [ 0, 0, 0, 0 ];

  // Handle events pre-processed by beaver.js
  beaver.on('appearance', function(event) {
    appearanceSynth[getWing(event)].triggerAttackRelease(
      APPEARANCE_FLOOR_NOTES[getFloor(event)],
      APPEARANCE_NOTE_DURATION
    );
    updateCounts();
    updateFloorVolumes();
  });
  beaver.on('displacement', function(event) {
    displacementSynth.triggerAttackRelease(
      DISPLACEMENT_FLOOR_NOTES[getFloor(event)],
      DISPLACEMENT_NOTE_DURATION
    );
    updateCounts();
    updateFloorVolumes();
  });
  beaver.on('keep-alive', function(event) {
  });
  beaver.on('disappearance', function(event) {
    disappearanceSynth[getWing(event)].triggerAttackRelease(
      DISAPPEARANCE_FLOOR_NOTES[getFloor(event)],
      DISAPPEARANCE_NOTE_DURATION
    );
    updateCounts();
    updateFloorVolumes();
  });

  // Get the floor on which the event occurred
  function getFloor(event) {
    var subdirectories = event.receiverDirectory.split(':');
    switch(subdirectories[1]) {
      case 'cafe':
        return 0;
      case 'first':
        return 1;
      case 'second':
        return 2;
      case 'third':
        return 3;
      default:
        return -1;
    }
  }

  // Get the wing on which the event occurred
  function getWing(event) {
    var subdirectories = event.receiverDirectory.split(':');
    switch(subdirectories[2]) {
      case 'west':
        return 0;
      case 'east':
        return 2;
      default:
        return 1;
    }
  }

  // Update the number of devices detected in total, by floor and zone
  function updateCounts() {
    $scope.thirdFloorCounts[0] =
        getNumberOfDirectoryDevices('notman:third:west');
    $scope.thirdFloorCounts[1] =
        getNumberOfDirectoryDevices('notman:third:centre');
    $scope.thirdFloorCounts[2] =
        getNumberOfDirectoryDevices('notman:third:east');
    $scope.secondFloorCounts[0] =
        getNumberOfDirectoryDevices('notman:second:west');
    $scope.secondFloorCounts[1] =
        getNumberOfDirectoryDevices('notman:second:centre');
    $scope.secondFloorCounts[2] =
        getNumberOfDirectoryDevices('notman:second:east');
    $scope.firstFloorCounts[0] =
        getNumberOfDirectoryDevices('notman:first:west');
    $scope.firstFloorCounts[1] =
        getNumberOfDirectoryDevices('notman:first:centre');
    $scope.firstFloorCounts[2] =
        getNumberOfDirectoryDevices('notman:first:east');
    $scope.cafeCount = getNumberOfDirectoryDevices('notman:cafe');
    floorCounts[3] = $scope.thirdFloorCounts[0] + $scope.thirdFloorCounts[1] +
                     $scope.thirdFloorCounts[2];
    floorCounts[2] = $scope.secondFloorCounts[0] + $scope.secondFloorCounts[1]
                     + $scope.secondFloorCounts[2];
    floorCounts[1] = $scope.firstFloorCounts[0] + $scope.firstFloorCounts[1] +
                     $scope.firstFloorCounts[2];
    floorCounts[0] = $scope.cafeCount;
    totalCount = floorCounts[3] + floorCounts[2] + floorCounts[1] +
                 floorCounts[0];
  }

  // Update the relative volumes for the oscillators of each floor
  function updateFloorVolumes() {
    floorOsc[0].volume.value = ((floorCounts[0] * FLOOR_VOLUME_MULTIPLIER) /
                                (totalCount + 1)) + FLOOR_VOLUME_BASE;
    floorOsc[1].volume.value = ((floorCounts[1] * FLOOR_VOLUME_MULTIPLIER) /
                                (totalCount + 1)) + FLOOR_VOLUME_BASE;
    floorOsc[2].volume.value = ((floorCounts[2] * FLOOR_VOLUME_MULTIPLIER) /
                                (totalCount + 1)) + FLOOR_VOLUME_BASE;
    floorOsc[3].volume.value = ((floorCounts[3] * FLOOR_VOLUME_MULTIPLIER) /
                                (totalCount + 1)) + FLOOR_VOLUME_BASE;
  }

  // Get the number of devices in the given directory
  function getNumberOfDirectoryDevices(directory) {
    if(!$scope.directories.hasOwnProperty(directory)) {
      return 0;
    }
    return Object.keys($scope.directories[directory].devices).length;
  }

  // Initialise appearance synths
  function initialiseAppearanceSynths() {
    var synthOptions = {
      envelope: { attack: 0.1, decay: 0.1 },
      oscillator: { type: "sine" },
      modulation: { type: "sine" }
    };
    var pan = [];
    var synth = [];
    pan.push(new Tone.Panner(-1).toMaster());
    pan.push(new Tone.Panner(0).toMaster());
    pan.push(new Tone.Panner(1).toMaster());
    synth.push(new Tone.AMSynth(synthOptions).connect(pan[0]));
    synth.push(new Tone.AMSynth(synthOptions).connect(pan[1]));
    synth.push(new Tone.AMSynth(synthOptions).connect(pan[2]));
    return synth;
  }

  // Initialise displacement synth
  function initialiseDisplacementSynth() {
    var effect = new Tone.PingPongDelay({
      delayTime: 0.25,
      maxDelayTime: 1
    }).toMaster();
    var synth = new Tone.MembraneSynth({
        pitchDecay: -0.2,
        octaves: 2,
        oscillator: { type:"sine" },
        envelope: {
          attack: 0.1,
          decay: 0.1,
          sustain: 0.01,
          release: 2.0,
          attackCurve: "exponential"
        }     
    }).connect(effect);
    return synth;
  }

  // Initialise the floor oscillators
  function initialiseFloorOscillators() {
    var pan = [];
    var osc = [];
    pan.push(new Tone.AutoPanner(0.25).toMaster().start());
    pan.push(new Tone.AutoPanner(0.5).toMaster().start());
    pan.push(new Tone.AutoPanner(1).toMaster().start());
    pan.push(new Tone.AutoPanner(2).toMaster().start());
    osc.push(new Tone.AMOscillator("C2", "sine", "sine")
                     .connect(pan[0]).start());
    osc.push(new Tone.AMOscillator("E2", "sine", "sine")
                     .connect(pan[1]).start());
    osc.push(new Tone.AMOscillator("G2", "sine", "sine")
                     .connect(pan[2]).start());
    osc.push(new Tone.AMOscillator("C3", "sine", "sine")
                     .connect(pan[3]).start());
    osc[0].volume.value = FLOOR_VOLUME_BASE;
    osc[1].volume.value = FLOOR_VOLUME_BASE;
    osc[2].volume.value = FLOOR_VOLUME_BASE;
    osc[3].volume.value = FLOOR_VOLUME_BASE;
    return osc;
  }

  // Initialise disappearance synths
  function initialiseDisappearanceSynths() {
    var synthOptions = {
      envelope: { attack: 0.1, decay: 0.1 },
      oscillator: { type: "square" },
      modulation: { type: "square" }
    };
    var pan = [];
    var synth = [];
    pan.push(new Tone.Panner(-1).toMaster());
    pan.push(new Tone.Panner(0).toMaster());
    pan.push(new Tone.Panner(1).toMaster());
    synth.push(new Tone.AMSynth(synthOptions).connect(pan[0]));
    synth.push(new Tone.AMSynth(synthOptions).connect(pan[1]));
    synth.push(new Tone.AMSynth(synthOptions).connect(pan[2]));
    return synth;
  }
});
