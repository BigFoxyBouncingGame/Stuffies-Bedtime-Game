function smoothstep(edge0, edge1, x) {
    if (x < edge0)
      return 0;
  
    if (x >= edge1)
      return 1;
  
    // Scale/bias into [0..1] range
    x = (x - edge0) / (edge1 - edge0);
  
    return x * x * (3 - 2 * x);
  }
  var foxyTransform = null;
  var foxyPosition = null;
  
  var camera = null;
  var prepareJumpStartTime = 0;
  var jumpStartTime = 0;
  var lastStepTime = 0;
  var landingStartTime = 0;
  var preparingToJump = false;
  var jumping = false;
  var landing = false;
  var velocity_y = 0;
  var landing_velocity = 0;
  var nextJumpStartTime = 0;
  var nextJumpPrepLength = 0;
  var pitchForward = false;
  var pitchBackward = false;
  var yawCW = false;
  var yawCCW = false;
  var lastPitch = 0;
  var pitchDirectionAtJump = 0;
  var changePitchTime = 0;
  var octree = null;
  var level_meshes = null;
  var foxy_halfwidth = 1;
  var foxy_bottom_offset = 0;
  var foxy_top_offset = 0;
  
  const yawSpeed = 0.1;
  const maxPitch = Math.PI / 16;
  const maxLateralSpeed = 0.1;
  function prepareNextJump() {
    nextJumpStartTime = getTimeInSeconds() + Math.random() * 0.5;
    nextJumpPrepLength = 2.0 * Math.random() ** 2.0 + 0.1;
  }
  function getTimeInSeconds() {
    return Date.now() / 1000;
  }
  function currentPitchDirection() {
    if (pitchForward && !pitchBackward) {
      return 1;
    }
    else if (pitchBackward && !pitchForward) {
      return -1;
    }
    else {
      return 0;
    }
  }
  function interpolatedCurrentPitch() {
    return smoothstep(0, 0.05, getTimeInSeconds() - changePitchTime) * (currentPitchDirection() * maxPitch - lastPitch) + lastPitch;
  }
  function currentYawDirection() {
    if (yawCW && !yawCCW) {
      return 1;
    }
    else if (yawCCW && !yawCW) {
      return -1;
    }
    else {
      return 0;
    }
  }
  function startYawing(direction) {
    if (direction == 1) {
      yawCW = true;
    }
    else {
      yawCCW = true;
    }
  }
  function stopYawing(direction) {
    if (direction == 1) {
      yawCW = false;
    }
    else {
      yawCCW = false;
    }
  }
  function testCollisions(from, to) {
    var ray = new BABYLON.Ray(from, to, from.subtract(to).length());
    var x_hit_pos;
    var y_hit_pos;
    var z_hit_pos;
    for (var i in level_meshes) {
      var m = level_meshes[i];
  
      if (m.id == "Room") {
        var extents = BABYLON.Mesh.MinMax([m]);
        if (to.z - foxy_halfwidth < extents.min.z) {
          y_hit_pos = extents.min.z + foxy_halfwidth;
        }
        if (to.z + foxy_halfwidth > extents.max.z) {
          y_hit_pos = extents.max.z - foxy_halfwidth;
        }
        if (to.x - foxy_halfwidth < extents.min.x) {
          x_hit_pos = extents.min.x + foxy_halfwidth;
        }
        if (to.x + foxy_halfwidth > extents.max.x) {
          x_hit_pos = extents.max.x - foxy_halfwidth;
        }
  
        console.log(m.id);
      }
      else if (m.id != "__root__") {
        var pickingInfo = m.intersects(ray, false, null, true);
        if (pickingInfo != null && pickingInfo.hit) {
          //        return pickingInfo;
        }
      }
    }
    if (y_hit_pos != null || x_hit_pos != null || z_hit_pos != null) {
      return {
        x_hit_pos: x_hit_pos,
        y_hit_pos: y_hit_pos,
        z_hit_pos: z_hit_pos
      }
    }
  }
  function startPitching(direction) {
    lastPitch = foxyTransform.rotation.z;
    changePitchTime = getTimeInSeconds();
    if (direction == 1) {
      pitchForward = true;
    }
    else {
      pitchBackward = true;
    }
  }
  function stopPitching(direction) {
    lastPitch = foxyTransform.rotation.z;
    changePitchTime = getTimeInSeconds();
    if (direction == 1) {
      pitchForward = false;
    }
    else {
      pitchBackward = false;
    }
  }
  function startPrepareJump() {
    if (!jumping && !landing) {
      if (!preparingToJump) {
        prepareJumpStartTime = getTimeInSeconds();
      }
      preparingToJump = true;
    }
  }
  function startJump() {
    if (!jumping && !landing) {
      pitchDirectionAtJump = currentPitchDirection();
      jumpStartTime = getTimeInSeconds();
      preparingToJump = false;
      jumping = true;
      var prepTime = getTimeInSeconds() - prepareJumpStartTime;
      velocity_y = smoothstep(-0.2, 2, prepTime) * 20 + 2;
    }
  }
  function doStep() {
    if (getTimeInSeconds() > nextJumpStartTime) {
      startPrepareJump();
    }
    if (getTimeInSeconds() > nextJumpStartTime + nextJumpPrepLength) {
      startJump();
    }
    var roll = 0;
    var yaw = foxyTransform.rotation.y + currentYawDirection() * yawSpeed;
    var pitch = interpolatedCurrentPitch();
    var squish = 0;
    if (preparingToJump) {
      var prepTime = getTimeInSeconds() - prepareJumpStartTime;
      const freq = 1.0 / 7;
      const amp = 0.1;
      squish = smoothstep(0, 0.1, prepTime) * 0.5;
      roll = smoothstep(0.3, 1, prepTime) * Math.sin((prepTime / freq) * Math.PI * 2) * amp;
    }
    if (jumping) {
      var deltaTime = getTimeInSeconds() - lastStepTime;
      const gravity = 9.8;
      var newFoxyPosition = new BABYLON.Vector3();
      newFoxyPosition.z = foxyPosition.z + (pitchDirectionAtJump * maxLateralSpeed) * Math.cos(foxyTransform.rotation.y);
      newFoxyPosition.x = foxyPosition.x + (pitchDirectionAtJump * maxLateralSpeed) * Math.sin(foxyTransform.rotation.y);
      newFoxyPosition.y = foxyPosition.y + deltaTime * velocity_y;
      velocity_y = velocity_y - (gravity * deltaTime);
      squish = 0.2 - 0.6 * Math.abs(velocity_y) / 20;
  
      collision = testCollisions(foxyPosition, newFoxyPosition);
      if (collision == null) {
        //    intersections = octree.intersectsRay(new BABYLON.Ray(foxyPosition, newFoxyPosition));
        //    if (intersections.length == 0) {
        foxyPosition = newFoxyPosition;
      }
      else {
        // intersection
        if (collision.x_hit_pos != null) {
          pitchDirectionAtJump = -pitchDirectionAtJump;
          newFoxyPosition.x = collision.x_hit_pos + pitchDirectionAtJump * maxLateralSpeed;
        }
        if (collision.z_hit_pos != null) {
          //        velocity_z = -velocity_z;
          //        newFoxyPosition.z = collision.z_hit_pos + velocity_z;
        }
        foxyPosition = newFoxyPosition;
        console.log("intersects: " + collision);
        //        foxyPosition = newFoxyPosition;
      }
      if (foxyPosition.y < 0) {
        landing_velocity = velocity_y;
        velocity_y = 0;
        foxyPosition.y = 0;
        jumping = false;
        landing = true;
        landingStartTime = getTimeInSeconds();
      }
    }
    if (landing) {
      var landingTime = getTimeInSeconds() - landingStartTime;
      var max_squish = 0.2 * landing_velocity / 20.0;
      squish = max_squish * Math.cos(4.0 * Math.sqrt(landingTime) + Math.PI / 2);
      if (landingTime > 0.6) {
        landing = false;
        squish = 0;
        prepareNextJump();
      }
    }
    foxyTransform.rotation = new BABYLON.Vector3(roll, yaw, pitch);
    foxyTransform.scaling = new BABYLON.Vector3(Math.sqrt(1.0 / (1 - squish * 0.78)), 1 - squish, Math.sqrt(1.0 / (1 - squish * 0.78)));
    foxyTransform.position = foxyPosition.add(new BABYLON.Vector3(0, -squish, 0));
  
    lastStepTime = getTimeInSeconds();
  }
  function setupGame() {
    const canvas = document.getElementById("renderCanvas");
    const engine = new BABYLON.Engine(canvas, true);
  
    const createScene = function() {
      const scene = new BABYLON.Scene(engine);
  
  
      // load level
      BABYLON.SceneLoader.ImportMeshAsync("", "Level", "1.glb").then((result) => {
        level_meshes = result.meshes;
  
        // load big foxy
        BABYLON.SceneLoader.ImportMeshAsync("", "BIG", "FOXY_v2.glb").then((result) => {
          foxyTransform = result.meshes[1];
          foxyTransform.parent = null;
          foxyTransform.rotation.y = Math.PI;
          foxyPosition = foxyTransform.position;
  
          camera.lockedTarget = foxyTransform; //version 2.5 onwards
  
          //        octree = scene.createOrUpdateSelectionOctree(64, 2);
          //        octree.dynamicContent.push(foxyTransform);
  
  
          prepareNextJump();
          console.log(result);
        })
      });
  
      // setup camera
      // Parameters: name, position, scene
      camera = new BABYLON.FollowCamera("FollowCam", new BABYLON.Vector3(0, 10, -10), scene);
  
      // The goal distance of camera from target
      camera.radius = 30;
  
      // The goal height of camera above local origin (centre) of target
      camera.heightOffset = 1;
  
      // The goal rotation of camera around local origin (centre) of target in x y plane
      camera.rotationOffset = 0;
  
      // Acceleration of camera in moving from current to goal position
      camera.cameraAcceleration = 0.1;
  
      // The speed at which acceleration is halted
      camera.maxCameraSpeed = 10;
  
      // This attaches the camera to the canvas
      camera.attachControl(canvas, true);
  
      const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0));
      return scene;
    };
    const scene = createScene();
  
    engine.runRenderLoop(function() {
      if (foxyTransform != null) {
        doStep();
      }
      scene.render();
    });
    window.addEventListener("resize", function() {
      engine.resize();
    })
    window.addEventListener("keydown", function(ev) {
      if (foxyTransform != null) {
        if (ev.key == "a") {
          startPitching(1);
        }
        if (ev.key == "d") {
          startPitching(-1);
        }
        if (ev.key == "q") {
          startYawing(1);
        }
        if (ev.key == "e") {
          startYawing(-1);
        }
      }
    });
    window.addEventListener("keyup", function(ev) {
      if (foxyTransform != null) {
        if (ev.key == "a") {
          stopPitching(1);
        }
        if (ev.key == "d") {
          stopPitching(-1);
        }
        if (ev.key == "q") {
          stopYawing(1);
        }
        if (ev.key == "e") {
          stopYawing(-1);
        }
      }
    });
  }