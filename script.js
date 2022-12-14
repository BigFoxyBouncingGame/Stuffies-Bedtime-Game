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
var lastPitch = 0;
var pitchDirectionAtJump = 0;
var changePitchTime = 0;
var octree = null;
var level_meshes = null;
var level_extents = null;
var foxy_halfwidth = 1;
var foxy_bottom_offset = 1;
var foxy_top_offset = 1;
var url_prefix = "https://bigfoxybouncinggame.github.io/Stuffies-Bedtime-Game/";
var foxyPitchAnimation = null;
var foxyAnimRestFrame = 60;
var won = false

const speed_modifier = 2.0;
const yawSpeed = 0.1;
const maxLateralSpeed = 0.1;

function getLevelsInfo() {
    var level = 1;
    var max_level = 1;
    const urlParams = new URLSearchParams(location.search);
    var level = urlParams.get("level");
    var max_level = urlParams.get("max-level");
    if (level == null) { level = 1; }
    if (max_level == null) {max_level = 1; }
    return {
        level: level,
        max_level: max_level
    }
}

function doYouWon() {
    const levelInfo = getLevelsInfo();
    if (levelInfo.level == levelInfo.max_level) {
        const youWinPanel = document.getElementById("you-win");
        youWinPanel.style.visibility = "visible" ;
    }
    else {
        const nextLevelPanel = document.getElementById("next-level");
        nextLevelPanel.style.visibility = "visible" ;
        nextLevelPanel.addEventListener("mouseup", (ev) => {
            const currentHref = window.location.href;
            const newLevelHref = currentHref.substring(0, currentHref.length - window.location.search.length)
                +"?level="+(levelInfo.level+1)+"&max-level="+(levelInfo.max_level);
            window.location.replace(newLevelHref);
            intro.hidden = true;
        })
    
    }
}

function prepareNextJump() {
    nextJumpStartTime = getTimeInSeconds() + (Math.random() * 0.5);
    nextJumpPrepLength = 2.0 * Math.random() ** 2.0 + 0.1;
}
function getTimeInSeconds() {
    return speed_modifier * Date.now() / 1000;
}
var pitchAtLastTick = 0;
var timeAtLastTick = 0;
function currentPitchDirection() {
    var pitch = getKeyPair("a","d");
    if (pitch != pitchAtLastTick) {
        changePitchTime = getTimeInSeconds();
        lastPitch = pitchAtLastTick;
        timeAtLastTick = getTimeInSeconds();

        pitchAtLastTick = pitch;
    }

    return pitch;

}
function interpolatedCurrentPitch() {
    const deltaTime = getTimeInSeconds() - changePitchTime;
    const pitchChangeTime = 0.3;
    const percent = deltaTime / pitchChangeTime;
    if (percent > 1) {
        return currentPitchDirection();
    }
    else {
        return smoothstep(0, 1, percent) * (currentPitchDirection() - lastPitch) + lastPitch;
    }
}
function currentYawDirection() {
    return getKeyPair("e","q");
}
function testCollisions(from, to) {
    var bottom_offset_vec = new BABYLON.Vector3(0,foxy_bottom_offset - 0.01,0);
    var top_offset_vec = new BABYLON.Vector3(0,foxy_top_offset,0);

    var direction = to.subtract(from);
    var length = direction.length();
    direction = direction.normalize();

    var ray = new BABYLON.Ray(from, direction, length);
    var ray_bottom = new BABYLON.Ray(from.subtract(bottom_offset_vec), direction, length);
    var ray_top = new BABYLON.Ray(from.add(top_offset_vec), direction, length);
    var x_hit_pos;
    var y_hit_pos;
    var z_hit_pos;
    var top_hit = false;
    var mesh_id = null;

    // scene picking instead
    var hit = scene.pickWithRay(ray);
    var hit_bottom = scene.pickWithRay(ray_bottom);   
    var hit_top = scene.pickWithRay(ray_top);

    hit = hit_bottom;
    if (hit) {
        if (hit.hit && hit.distance < ray.length) {
            var normal = hit.getNormal(true);
            var pickedPoint = hit.pickedPoint.add(normal.scale(foxy_halfwidth));
            pickedPoint.y = hit.pickedPoint.y;
            var primarylength = Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
            if (normal.y == primarylength) {
                y_hit_pos = pickedPoint.y + foxy_bottom_offset;
            }
            else if (Math.abs(normal.x) == primarylength) {
                x_hit_pos = pickedPoint.x;
            }
            else if (Math.abs(normal.z) == primarylength) {
                z_hit_pos = pickedPoint.z;
            }
            mesh_id = hit.pickedMesh.id;
        }
    }

    hit = hit_top;
    if (hit) {
        if (hit.hit && hit.distance < ray.length) {
            var normal = hit.getNormal(true);
            var pickedPoint = hit.pickedPoint.add(normal.scale(foxy_halfwidth));
            pickedPoint.y = hit.pickedPoint.y;
            var primarylength = Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
            if (normal.y == -primarylength) {
                y_hit_pos = pickedPoint.y - foxy_top_offset;
                // random guess above
                top_hit = true;
            }
            else if (Math.abs(normal.x) == primarylength) {
                x_hit_pos = pickedPoint.x;
            }
            else if (Math.abs(normal.z) == primarylength) {
                z_hit_pos = pickedPoint.z;
            }
            mesh_id = hit.pickedMesh.id;
        }
    }

    
    // room extents
    if (z_hit_pos == null) {
        if (to.z - foxy_halfwidth < level_extents.min.z) {
            z_hit_pos = level_extents.min.z + foxy_halfwidth;
        }
        if (to.z + foxy_halfwidth > level_extents.max.z) {
            z_hit_pos = level_extents.max.z - foxy_halfwidth;
        }
    }
    if (x_hit_pos == null) {
        if (to.x - foxy_halfwidth < level_extents.min.x) {
            x_hit_pos = level_extents.min.x + foxy_halfwidth;
        }
        if (to.x + foxy_halfwidth > level_extents.max.x) {
            x_hit_pos = level_extents.max.x - foxy_halfwidth;
        }
    }
    if (y_hit_pos == null) {
        if (to.y - foxy_bottom_offset < level_extents.min.y) {
            y_hit_pos = level_extents.min.y + foxy_bottom_offset;
        }
        if (to.y + foxy_top_offset > level_extents.max.y) {
            // note: we haven't tested this case yet, I hope it works
            top_hit = true;
            y_hit_pos = level_extents.max.y - foxy_top_offset;
        }
    }



    if (y_hit_pos != null || x_hit_pos != null || z_hit_pos != null) {
        return {
            x_hit_pos: x_hit_pos,
            y_hit_pos: y_hit_pos,
            z_hit_pos: z_hit_pos,
            mesh_id: mesh_id,
            top_hit: top_hit
        }
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
function updateCameraPosition() {
//    newFoxyPosition.z = foxyPosition.z + (pitchDirectionAtJump * maxLateralSpeed) * Math.cos(foxyTransform.rotation.y + Math.PI/2);
//  newFoxyPosition.x = foxyPosition.x + (pitchDirectionAtJump * maxLateralSpeed) * Math.sin(foxyTransform.rotation.y + Math.PI/2);
    var foxyRight = new BABYLON.Vector3(Math.sin(foxyTransform.rotation.y+Math.PI),0,Math.cos(foxyTransform.rotation.y+Math.PI));
    var idealCameraDistance = 30;
    const maxCameraChange = 1;
    var cameraIdealPosition = foxyTransform.position.add(foxyRight.scale(idealCameraDistance));
    var ray = new BABYLON.Ray(foxyPosition, cameraIdealPosition.subtract(foxyPosition).normalize());

    var hit = scene.pickWithRay(ray);


    var cameraLimitedPosition = null;

    if (hit && hit.hit && hit.distance < idealCameraDistance) {
        cameraLimitedPosition = hit.pickedPoint;
    }
    else {
        cameraLimitedPosition = cameraIdealPosition;
    }
    const buffer = new BABYLON.Vector3(-0.5,0,-0.5);
    cameraLimitedPosition = BABYLON.Vector3.Clamp(cameraLimitedPosition, level_extents.min.subtract(buffer), level_extents.max.add(buffer));

    if (cameraLimitedPosition.subtract(camera.position).length() > maxCameraChange) {
        camera.position = camera.position.add((cameraLimitedPosition.subtract(camera.position).normalize().scale(maxCameraChange)));
    }
    else {
        camera.position = cameraLimitedPosition;
    }
    // if camera is too close to target, push camera up slightly
    var cameraDistance = camera.position.subtract(foxyTransform.position).length();
    const minCameraDistance = 3;
    if (cameraDistance < minCameraDistance) {
        camera.position.y += (minCameraDistance-cameraDistance);
    }
}
function doStep() {
    currentPitchDirection(); // call this early because it updates state about changes and last change time
    if (getTimeInSeconds() > nextJumpStartTime) {
        startPrepareJump();
    }
    if (getTimeInSeconds() > nextJumpStartTime + nextJumpPrepLength) {
        startJump();
    }
    var roll = 0;
    var yaw = foxyTransform.rotation.y + currentYawDirection() * yawSpeed;
    var pitch = 0;
    var squish = 0;
    foxyPitchAnimation.play();
    foxyPitchAnimation.goToFrame(foxyAnimRestFrame + Math.round(interpolatedCurrentPitch()*60));
    foxyPitchAnimation.pause();
    if (preparingToJump) {
        var prepTime = getTimeInSeconds() - prepareJumpStartTime;
        const freq = 1.0 / 7;
        const amp = 0.1;
        squish = smoothstep(0, 0.1, prepTime) * 0.5;
        roll = smoothstep(0.3, 1, prepTime) * Math.sin((prepTime / freq) * Math.PI * 2 / speed_modifier) * amp;
    }
    if (jumping) {
        var deltaTime = getTimeInSeconds() - lastStepTime;
        const gravity = 9.8;
        var newFoxyPosition = new BABYLON.Vector3();
        newFoxyPosition.z = foxyPosition.z + (pitchDirectionAtJump * maxLateralSpeed) * Math.cos(foxyTransform.rotation.y + Math.PI/2);
        newFoxyPosition.x = foxyPosition.x + (pitchDirectionAtJump * maxLateralSpeed) * Math.sin(foxyTransform.rotation.y + Math.PI/2);
        newFoxyPosition.y = foxyPosition.y + deltaTime * velocity_y;
        velocity_y = velocity_y - (gravity * deltaTime);
        squish = 0.2 - 0.6 * Math.abs(velocity_y) / 20;

        collision = testCollisions(foxyPosition, newFoxyPosition);
        if (collision == null) {
            foxyPosition = newFoxyPosition;
        }
        else {
            // intersection
            var delta = newFoxyPosition.subtract(foxyPosition);
            if (collision.x_hit_pos != null) {
                if (Math.abs(delta.x) > Math.abs(delta.z)) {
                    // in a sharp hit, we reverse direction and make a small change of angle
                    pitchDirectionAtJump *= -1;
                    yaw = -foxyTransform.rotation.y;
                }
                else {
                    // in a shallow hit, we bounce off the wall and point the new direction.
                    yaw = Math.PI - foxyTransform.rotation.y;
                }
                newFoxyPosition.x = collision.x_hit_pos + (foxyPosition.x - newFoxyPosition.x);
            }
            if (collision.z_hit_pos != null) {
                if (Math.abs(delta.z) > Math.abs(delta.x)) {
                    pitchDirectionAtJump *= -1;
                    yaw = Math.PI - foxyTransform.rotation.y;
                }
                else {
                    yaw = -foxyTransform.rotation.y;
                }
                newFoxyPosition.z = collision.z_hit_pos + (foxyPosition.z - newFoxyPosition.z);
            }
            if (collision.y_hit_pos != null) {
                if (collision.top_hit) {
                    // todo: this should squash vertically
                    velocity_y = 0;
                    newFoxyPosition.y = collision.y_hit_pos - 0.01;
                }
                else {
                    if (collision.mesh_id && collision.mesh_id.includes("BED")) {
                        won = true;
                    }
                    landing_velocity = velocity_y;
                    velocity_y = 0;
                    newFoxyPosition.y = collision.y_hit_pos;
                    jumping = false;
                    landing = true;
                    landingStartTime = getTimeInSeconds();
                }
            }
            foxyPosition = newFoxyPosition;
        }
    }
    if (landing) {
        var landingTime = getTimeInSeconds() - landingStartTime;
        var max_squish = 0.2 * landing_velocity / 20.0;
        squish = max_squish * Math.cos(4.0 * Math.sqrt(landingTime) + Math.PI / 2);
        if (landingTime > 0.6) {
            if (won) {
                doYouWon();
            }
            else {
                landing = false;
                squish = 0;
                prepareNextJump();
            }
        }
    }
    foxyTransform.rotation = new BABYLON.Vector3(roll, yaw, pitch);
    foxyTransform.scaling = new BABYLON.Vector3(Math.sqrt(1.0 / (1 - squish * 0.78)), 1 - squish, Math.sqrt(1.0 / (1 - squish * 0.78)));
    foxyTransform.position = foxyPosition.add(new BABYLON.Vector3(0, -squish, 0));

    updateCameraPosition();

    lastStepTime = getTimeInSeconds();
}
function setupGame() {
    const intro = document.getElementById("intro");
    intro.addEventListener("mouseup", (ev) => {
        intro.hidden = true;
    })
    const canvas = document.getElementById("renderCanvas");
    const engine = new BABYLON.Engine(canvas, true);

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);

        // load level
        
        BABYLON.SceneLoader.ImportMeshAsync("", url_prefix, "Level"+getLevelsInfo().level+".glb").then((result) => {
            level_meshes = result.meshes;
            var room_meshes = [];
            for (var i = 0; i < result.meshes.length; i++) {
                level_meshes[i].receiveShadows = true;
                if (level_meshes[i].id.startsWith("Room")) {
                    room_meshes.push(level_meshes[i]);
                    level_meshes[i].isPickable = false;
                }
                if (level_meshes[i].id.startsWith("v")) {
                    var invisibleMat = new BABYLON.StandardMaterial("invisibleMat", scene);
                    invisibleMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
                    invisibleMat.alpha = 0;
                    level_meshes[i].material = invisibleMat;
                }
                if (level_meshes[i].id.startsWith("c")) {
                    level_meshes[i].isPickable = false;
                }
            }
            level_extents = BABYLON.Mesh.MinMax(room_meshes);

            // load big foxy
            BABYLON.SceneLoader.ImportMeshAsync("", url_prefix, "BIGFOXY_v2.glb").then((result) => {
                foxyTransform = result.meshes[1];
                foxyTransform.isPickable = false;
                foxyTransform.parent = null;
                foxyTransform.rotation.y = Math.PI;
                foxyPosition = foxyTransform.position;

                for (var i = 0; i < scene.animationGroups.length; i++) {
                    if (scene.animationGroups[i].name == "FoxyAction") {
                        foxyPitchAnimation = scene.animationGroups[i];
                        foxyPitchAnimation.goToFrame(30);
                        foxyPitchAnimation.stop();
                    }
                    else {
                        scene.animationGroups[i].play();
                        scene.animationGroups[i].loopAnimation = true;
                    }
                }

                camera.lockedTarget = foxyTransform; //version 2.5 onwards

                octree = scene.createOrUpdateSelectionOctree(64, 2);
                octree.dynamicContent.push(foxyTransform);

                var shadow_caster = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(0, -1, 0), scene);
                shadow_caster.position = new BABYLON.Vector3(0, level_extents.max.y, 0);
                shadow_caster.autoUpdateExtends = true;
                shadow_caster.autoCalcShadowZBounds;

                // todo: fix shadow quality
        //          shadow_caster.shadowMinZ = shadow_caster.position.y - level_extents.max.y;
        //          shadow_caster.shadowMaxZ = shadow_caster.shadowMinZ + (level_extents.max.y - level_extents.min.y) + 20;
            
                const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0));
                light.diffuse = new BABYLON.Color3(0.4, 0.4, 0.4);
                light.specular = new BABYLON.Color3(0.4, 0.4, 0.4);
                light.groundColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                var shadowGenerator = new BABYLON.ShadowGenerator(1024, shadow_caster);
                shadowGenerator.getShadowMap().renderList.push(foxyTransform);
                shadowGenerator.useBlurExponentialShadowMap = true;
                shadowGenerator.useKernelBlur = true;
                shadowGenerator.blurKernel = 64;
            
                prepareNextJump();
            });
        });

        // setup camera
        // Parameters: name, position, scene
        camera = new BABYLON.FreeCamera("FollowCam", new BABYLON.Vector3(0, 10, -10), scene);

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

        return scene;
    };
    scene = createScene();

    engine.runRenderLoop(function() {
        if (foxyTransform != null) {
            doStep();
            scene.render();
        }
    });
    window.addEventListener("resize", function() {
        engine.resize();
    })
    setupKeyHelper(getTimeInSeconds);
}