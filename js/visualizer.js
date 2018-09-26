// CAPTURE THE SOUND
// Older browsers might not implement mediaDevices at all, so we set an empty object first
if (navigator.mediaDevices === undefined) {
  navigator.mediaDevices = {};
}

// set up forked web audio context, for multiple browsers
// window. is needed otherwise Safari explodes
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var source;
var stream;


//set up the different audio nodes we will use for the app
var analyser = audioCtx.createAnalyser();
analyser.minDecibels = -90;
analyser.maxDecibels = -10;
analyser.smoothingTimeConstant = 0.85;

var gainNode = audioCtx.createGain();


//main block for doing the audio recording
var dataArrayAlt;
if (navigator.mediaDevices.getUserMedia) {
   var constraints = { audio: true }
   navigator.mediaDevices.getUserMedia (constraints)
      .then(
        function(stream) {
           source = audioCtx.createMediaStreamSource(stream);
           source.connect(analyser);
           analyser.connect(gainNode);
           gainNode.connect(audioCtx.destination);

           analyser.fftSize = 256;
           var bufferLengthAlt = analyser.frequencyBinCount;
           dataArrayAlt = new Uint8Array(bufferLengthAlt);
           analyser.getByteFrequencyData(dataArrayAlt);
      })
      .catch( function(err) {
        console.log('The following getUserMedia error occured: ' + err);
      });
} else {
        console.log('getUserMedia not supported on your browser!');
}



// VISUAL EFFECTS
// Constants
var NUM_BINS = 25; // Array of frequencies has 128 bins. Most of them are not used
var MAX_VOLUME_PER_BIN = 150;
var MAX_COLOR_PER_BIN = 100;

var MIN_RADIUS = 10;
var MAX_RADIUS = 500;
var target_radius = 50;
var PARTICLE_SPEED = 3;

// scene size
var WIDTH = window.innerWidth,
    HEIGHT = window.innerHeight;
// camera attributes
var VIEW_ANGLE = 45,
    ASPECT = WIDTH / HEIGHT,
    NEAR = 0.1,
    FAR = 10000;

// Utility Functions
function rgbToHex(r, g, b) {
  return "0x" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getRGB(arr) {
  let redCount = 0;
  let greenCount = 0;
  let blueCount = 0;

  for (let i = 0; i < NUM_BINS / 3; i++) {
    blueCount += arr[i];
    greenCount += arr[i * 2];
    redCount += arr[i * 3];
  }
  return rgbToHex(Math.floor(redCount / (NUM_BINS * MAX_COLOR_PER_BIN) * 150 + 105),
                  Math.floor(greenCount / (NUM_BINS * MAX_COLOR_PER_BIN) * 255),
                  Math.floor(blueCount / (NUM_BINS * MAX_COLOR_PER_BIN) * 205 + 50));
}

function getParticleSpeed(startingRadius) {
  return .1 + (startingRadius / 100) ** 1.7;
}

// function getTargetRadius(target_radius, startingRadius) {
//   return target_radius - ((startingRadius / 100) ** 2);
// }

function getNewParticleCoordinates(x, y, startingRadius) {
  let currRadius = Math.sqrt(x**2 + y**2);
  let angle = Math.asin(y / currRadius);
  if (y < 0) {
    angle += Math.PI;
  }
  let newX, newY;
  if (currRadius < target_radius) { // move point outward
    newX = Math.cos(angle) * (currRadius + getParticleSpeed(startingRadius));
    newY = Math.sin(angle) * (currRadius + getParticleSpeed(startingRadius));
  } else { // move point inward
    newX = Math.cos(angle) * (currRadius - getParticleSpeed(startingRadius));
    newY = Math.sin(angle) * (currRadius - getParticleSpeed(startingRadius));
  }
  return { x: newX * Math.sign(x),
           y: newY * Math.sign(y)
         };
}

function getVolumeRatio(arr) {
  let volume = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    volume += arr[i];
  }
  return volume / (NUM_BINS * MAX_VOLUME_PER_BIN);
}

// @see http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (
  function() {
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function(/* function */ callback, /* DOMElement */ element){
              window.setTimeout(callback, 1000 / 60);
            };
  }
)();

// create a WebGL renderer, camera and a scene
var renderer = new THREE.WebGLRenderer();
var camera = new THREE.Camera(VIEW_ANGLE, ASPECT, NEAR, FAR);
var scene = new THREE.Scene();

// the camera starts at 0,0,0 so pull it back
camera.position.z = 1000;

// start the renderer - set the clear color to full black
renderer.setClearColor(new THREE.Color(0, 1));
renderer.setSize(WIDTH, HEIGHT);


// attach the render-supplied DOM element
var $container = $('#container');
$container.append(renderer.domElement);

// create the particle variables
var particleCount = 100000
    particles = new THREE.Geometry(),
    pMaterial = new THREE.ParticleBasicMaterial({
      color: 0xFFFFFF,
      size: 2
    });

// now create the individual particles
for(var p = 0; p < particleCount; p++) {

  // create a particle with random
  // position values around a circle
  var angle = Math.random()*Math.PI*2;
  var pX = Math.cos(angle) * (MIN_RADIUS + (Math.random() * 300)),
      pY = Math.sin(angle) * (MIN_RADIUS + (Math.random() * 300)),
      pZ = 0,
      particle = new THREE.Vertex( new THREE.Vector3(pX, pY, pZ) );

  particle.startingRadius = Math.sqrt(pX**2 + pY**2);

  // add it to the geometry
  particles.vertices.push(particle);
}

// create the particle system
var particleSystem = new THREE.ParticleSystem(
  particles,
  pMaterial);

particleSystem.materials[0].color = new THREE.Color(rgbToHex(255,255,255));

// add it to the scene
scene.addChild(particleSystem);

// moving outwards or not
var out = true;


// animation loop
function update() {
  if (dataArrayAlt != null) {
    analyser.getByteFrequencyData(dataArrayAlt);
    // console.log(getRGB(dataArrayAlt));
    particleSystem.materials[0].color = new THREE.Color(getRGB(dataArrayAlt));

    let volumeRatio = getVolumeRatio(dataArrayAlt);
    target_radius = MIN_RADIUS + volumeRatio * (MAX_RADIUS - MIN_RADIUS);
  }

  // add some rotation to the system
  particleSystem.rotation.z += 0.005;

  var asdjklsdjkl = 1;

  var pCount = particleCount;
  while(pCount--) {
    // get the particle
    var particle = particles.vertices[pCount];

    if (dataArrayAlt != null) {
      let newCoordinates = getNewParticleCoordinates(particle.position.x, particle.position.y, particle.startingRadius);
      particle.position.x = newCoordinates.x;
      particle.position.y = newCoordinates.y;
    }
  }

  // flag to the particle system that we've
  // changed its vertices. This is the
  // dirty little secret.
  particleSystem.geometry.__dirtyVertices = true;

  renderer.render(scene, camera);

  // set up the next call
  requestAnimFrame(update);
}

requestAnimFrame(update);
