// Copyright (c) 2017 The Dash Network
// Distributed under the MIT/X11 software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

var THREE = require('three');
var CANNON = require('cannon');
var io = require('socket.io-client');
var THREEx = require('./threex.dynamictexture.js');
THREE.OrbitControls = require('./OrbitControls.js');

// Dash Blockchain Visualizer using Three.js, Cannon.js and Insight API
DashMachine = function () {
    var _this = this;

    this.Set = new this.set(this);
    this.Net = new this.net(this);
    this.Objects = new this.objects(this);
    this.Materials = new this.materials(this);
    this.Audio = new this.audio(this);
    this.Settings = new this.settings(this);
    this.UI = new this.ui(this);

    this.options = null;
    this.camera = null;
    this.scene = null;
    this.renderer = null;
    this.canvas = null;
    this.world = null;
    this.bestBlock = null;
    this.playMode = null;
    this.QualityLevel = null;
    this.maxTx = 250;
    this.maxBlocks = 24;

    var preloadFrameCount = 0;
    this.PlayModes = {preload: 0, loaded: 1, play: 2};

    this.Start = function (options) {
        _this.playMode = _this.PlayModes.preload;
        _this.options = options || {};

        _this.canvas = _this.options.canvas || document.getElementById("canvas");
        _this.world = new CANNON.World();
        _this.scene = new THREE.Scene();

        this.Net.Init();
        this.Set.Init();
        this.Settings.Init();
        this.Materials.Init();
        this.UI.Init();

        PreLoad();
        Update();
    };

    this.AddBlock = function (block) {
        _this.bestBlock = block;
        _this.bestBlock.time = parseInt(new Date() / 1000);
        _this.Objects.addBlock(block.height);
        _this.UI.SetBlockHeightText(_this.bestBlock.height);
    };

    // Main loop
    function Update() {
        // Pre-Play Modes
        if (_this.playMode === _this.PlayModes.preload) {
            preloadFrameCount++;
        } else if (_this.playMode === _this.PlayModes.loaded) {
            // Wait for first block download
            if (_this.bestBlock) {
                // Start
                _this.UI.ShowLoader(false);
                _this.AddBlock(_this.bestBlock);
                _this.Net.Listen();
                _this.playMode = _this.PlayModes.play;

                // update block age once per second..
                setInterval(function () {
                    var dt = new Date(null);
                    dt.setSeconds((parseInt(new Date().getTime() / 1000) - _this.bestBlock.time));
                    _this.UI.SetNextBlockTime(dt.toISOString().substr(14, 5));
                }, 1000)
            }
        }
        _this.Objects.Update();
        _this.Set.Update();
        requestAnimationFrame(Update);
    }

    // run a benchmark at start to determine quality level and preload assets
    function PreLoad() {
        if (_this.options.blocker) {
            for (var i = 0; i < (_this.maxTx / 3); i++) {
                _this.Objects.AddTX((Math.random() < 0.9) ? Math.random() * 2 : Math.random() * 200);
            }
            for (var i = 0; i < (_this.maxBlocks / 3); i++) {
                _this.Objects.addBlock(1);
            }
            var preloadTime = 3200;
            setTimeout(function () {
                _this.Objects.Clear();
                _this.Settings.AutoSetQuality(preloadFrameCount / (preloadTime / 1000));
                _this.playMode = _this.PlayModes.loaded;
            }, preloadTime);
        } else {
            _this.playMode = _this.PlayModes.loaded;
        }
    }

    // util
    this.RandRange = function (min, max) {
        if (max) return Math.random() * (max - min) + min;
        return (Math.random() * 2 * min) - min;
    }
};

DashMachine.prototype.set = function (_this) {

    var orbitControl = null;
    this.spotLight = new THREE.SpotLight(0xffffff);
    this.spotLight2 = new THREE.SpotLight(0xffffff);
    this.spotLight3 = new THREE.SpotLight(0xffffff);
    this.spotLight4 = new THREE.SpotLight(0xffffff);

    var n = navigator.userAgent;
    this.isMobile = (n.match(/Android/i) || n.match(/webOS/i) || n.match(/iPhone/i) || n.match(/iPad/i) || n.match(/iPod/i) || n.match(/BlackBerry/i) || n.match(/Windows Phone/i));

    this.Init = function () {
        initRenderer();
        initLights();
        initCams();
        initSet();
    };

    this.Update = function () {
        _this.world.step(_this.Settings.TimeStep);
        _this.renderer.render(_this.scene, _this.camera);
        orbitControl.update();
    };

    function initRenderer() {

        _this.renderer = new THREE.WebGLRenderer({
            canvas: _this.canvas,
            precision: this.isMobile ? "lowp" : "mediump",
            antialias: !this.isMobile,
            sortObjects: false,
            preserveDrawingBuffer: false
        });
        _this.renderer.shadowMap.type = (_this.Set.isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap);
        _this.renderer.setSize(window.innerWidth, window.innerHeight);

        window.addEventListener('resize', function () {
            _this.camera.aspect = window.innerWidth / window.innerHeight;
            _this.camera.updateProjectionMatrix();
            _this.renderer.setSize(window.innerWidth, window.innerHeight);
        }, false);
    }

    function initCams() {
        var camY = 130, camW = 122, camFOV = 20;
        _this.camera = new THREE.PerspectiveCamera(camFOV, window.innerWidth / window.innerHeight, 1, 10000);
        _this.camera.position.set(-camW, camY, camW);
        _this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        // orbit
        orbitControl = new THREE.OrbitControls(_this.camera, _this.canvas);
        orbitControl.target.set(0, 0, 0);
        orbitControl.minDistance = 150;
        orbitControl.maxDistance = 275;
        orbitControl.autoRotate = true;
        orbitControl.autoRotateSpeed = 0.025;
        orbitControl.enablePan = false;
        orbitControl.minPolarAngle = 0.5;
        orbitControl.maxPolarAngle = 1.25;
        orbitControl.enableDamping = true;
        orbitControl.dampingFactor = 0.05;
        orbitControl.rotateSpeed = 0.1;
    }

    function initLights() {
        var ambientLight = new THREE.AmbientLight(0x3D4143);
        ambientLight.intensity = 3.25;
        ambientLight.castShadow = false;
        _this.scene.add(ambientLight);

        var dist = 1;
        var spotLightIntensity = 1;

        _this.Set.spotLight.position.set(200 * dist, 200 * dist, 50 * dist);
        _this.Set.spotLight.castShadow = false;
        _this.Set.spotLight2.intensity = spotLightIntensity;
        _this.scene.add(_this.Set.spotLight);

        _this.Set.spotLight2 = createSpotlight(-200 * dist, 200 * dist, 50 * dist, spotLightIntensity, 2048);
        _this.Set.spotLight3 = createSpotlight(200 * dist, 200 * dist, 50 * dist, spotLightIntensity * 0.3, 4096);
        _this.Set.spotLight4 = createSpotlight(-200 * dist, 200 * dist, 50 * dist, spotLightIntensity * 0.7, 4096);
    }

    function initSet() {

        // background
        var buffgeoBack = new THREE.BufferGeometry();
        buffgeoBack.fromGeometry(new THREE.IcosahedronGeometry(500, 2));
        var back = new THREE.Mesh(buffgeoBack, new THREE.MeshBasicMaterial(
            {
                map: _this.Materials.GetGradTex([[0.7, 0.5, 0.35, 0.25], ['#1B1D1E', '#3D4143', '#72797D', '#b0babf']]),
                side: THREE.BackSide,
                depthWrite: false,
                fog: false
            }));
        _this.scene.add(back);

        // ground cylinder
        var radius = 50, rSegs = 64, cheight = 100, yOffset = 0;

        // swap the cylinder face materials to get seperate top face
        var geoCyl = new THREE.CylinderGeometry(radius, radius, cheight, rSegs, 1, false);
        for (var i = 0; i < geoCyl.faces.length; i++) {
            if (i < (rSegs * 2)) {
                geoCyl.faces[i].materialIndex = 0;
            } else if (i > (rSegs * 2) + 1 && i < (rSegs * 3)) {
                geoCyl.faces[i].materialIndex = 1;
            }
        }
        // construct the mesh
        var groundMesh = new THREE.Mesh(geoCyl, [
            _this.Materials.matPlinth2, _this.Materials.matPlinth, _this.Materials.matPlinth2]);
        groundMesh.position.y = yOffset - (cheight / 2) + 0.5;
        groundMesh.castShadow = false;
        groundMesh.receiveShadow = true;
        _this.scene.add(groundMesh);

        // collider - we need to translate CANNON.js cylnder geom to THREE.js by aligning Z to Y axis
        var groundShape = new CANNON.Cylinder(radius * 1.01, radius * 1.01, cheight, rSegs / 3);
        var quat = new CANNON.Quaternion();
        quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundShape.transformAllPoints(new CANNON.Vec3(0, 0, 0), quat);
        var groundBody = new CANNON.Body({mass: 0, material: _this.Materials.groundPhysMat});
        groundBody.addShape(groundShape);
        groundBody.position.set(0, yOffset - (cheight / 2) + 0.5, 0);
        _this.world.addBody(groundBody);

        // additional collider, Cannon can't do continuous collisions
        var shape = new CANNON.Box(new CANNON.Vec3(radius * 0.69, 1, radius * 0.69));
        var body = new CANNON.Body({mass: 0, material: _this.Materials.groundPhysMat});
        body.addShape(shape);
        body.position.set(0, -0.5, 0);
        _this.world.addBody(body);
    }

    function createSpotlight(x, y, z, intensity, mapSize) {
        var sl = new THREE.SpotLight(0xffffff);
        sl.position.set(x, y, z);
        sl.shadow.darkness = 0.75;
        sl.shadow.camera.fov = 30;
        sl.shadow.camera.near = 0.5;
        sl.shadow.camera.far = 500;
        sl.shadow.mapSize.width = mapSize;
        sl.shadow.mapSize.height = mapSize;
        sl.castShadow = this.isMobile ? false : (mapSize === null);
        sl.intensity = intensity;
        _this.scene.add(sl);
        return sl;
    }
};

// Object Manager
DashMachine.prototype.objects = function (_this) {

    var ObjType = {Tx: 0, Block: 1};

    function ObjPool() {
        this.meshs = [];
        this.dynMeshs = [];
        this.bodys = [];
        this.dynamicTextures = [];
        this.active = [];
        this.objID = [];
        this.objActiveCount = 0;
        this.objLifetimeCount = 0;
        this.mats = [];
        this.data = [];
    }

    var xSpawnVar = 23;
    var ySpawnVar = 15;
    var dropH = 88;
    var dropForce = 20;
    var aVel = 0.25;
    var massMulti = 2;
    var scaleMulti = 3;
    var txObjects = new ObjPool();
    var blocksObjects = new ObjPool();

    var geo12 = new THREE.SphereGeometry(1, 12, 6);
    var geo16 = new THREE.SphereGeometry(1, 16, 8);
    var geo20 = new THREE.SphereGeometry(1, 20, 10);
    var geo24 = new THREE.SphereGeometry(1, 24, 12);
    var geo32 = new THREE.SphereGeometry(1, 32, 16);
    var geo48 = new THREE.SphereGeometry(1, 48, 24);

    this.Update = function () {
        updateObjects(txObjects);
        updateObjects(blocksObjects);
    };

    this.Clear = function () {
        clearObjects(txObjects);
        clearObjects(blocksObjects);
    };

    this.AddTX = function (amount) {
        if (amount > 0) addObject(ObjType.Tx, amount);
    };
    this.addBlock = function (height) {
        if (height > 0) addObject(ObjType.Block, height);
        if (_this.bestBlock) {
            // first block?
            if (_this.bestBlock.txAmount) {
                setTimeout(function () {
                    var outCounter = 0;
                    var addTimer = setInterval(function () {
                        if (_this.bestBlock.txAmount) {
                            _this.Objects.AddTX(_this.bestBlock.txAmount[outCounter]);
                            outCounter++;
                            if (outCounter >= _this.bestBlock.txAmount.length)
                                clearInterval(addTimer);
                        } else
                            clearInterval(addTimer);
                    }, 25);
                }, 750);
            }
        }
    };

    this.ResetGeom = function () {
        var objs = txObjects;
        if (objs.meshs) {
            for (var i = 0; i < objs.meshs.length; i++) {
                if (objs.meshs[i]) {
                    objs.meshs[i].geometry.dispose();
                    objs.meshs[i].geometry = getTXGeom(objs.data[i]);
                }
            }
        }
    };

    function getTXGeom(amount) {
        if (amount < 1) return (_this.QualityLevel === _this.Settings.QualityLevels.lo) ? geo12 : geo20;
        else if (amount < 10)  return (_this.QualityLevel === _this.Settings.QualityLevels.lo) ? geo12 : geo24;
        else if (amount < 100)  return (_this.QualityLevel === _this.Settings.QualityLevels.lo) ? geo16 : geo24;
        else if (amount < 1000)  return (_this.QualityLevel === _this.Settings.QualityLevels.lo) ? geo16 : geo32;
        else  return (_this.QualityLevel === _this.Settings.QualityLevels.lo) ? geo24 : geo48;
    }

    function addObject(objType, data) {
        var objs = objType === ObjType.Tx ? txObjects : blocksObjects;
        var i = objs.active.length;

        // replace an existing object if the pool is full
        if (((objType === ObjType.Tx) && (i >= _this.maxTx))
            || ((objType === ObjType.Block) && (i >= _this.maxBlocks))) {

            // find the first inactive obj we can replace
            var freeSlot = -1;
            for (var j = 0; j < objs.active.length; j++) {
                if (objs.active[j] === false) {
                    freeSlot = j;
                    break;
                }
            }
            if (freeSlot < 0) {
                // get the oldest obj we can replace
                var oldestID = objs.objLifetimeCount;
                var oldestIndex = 0;
                for (var j = 0; j < objs.objID.length; j++) {
                    if (objs.objID[j] < oldestID) {
                        oldestID = objs.objID[j];
                        oldestIndex = j;
                    }
                }
                freeSlot = oldestIndex;
            }
            removeObject(objs, freeSlot);
            i = freeSlot;
        }
        objs.data[i] = data;
        var w = 0;
        var mass = 0;

        // volume and mass
        if (objType === ObjType.Tx) {
            if (data < 1) {
                w = Math.max(data * scaleMulti, 0.4 * scaleMulti);
                if (w > 0.6 * scaleMulti) w = 0.6 * scaleMulti;
            } else {
                // spherical volume
                w = Math.max((Math.log(Math.cbrt(data / 4.18879)) + 1) * scaleMulti, 0.7 * scaleMulti);
            }
            mass = Math.pow(w, 3) * 4.18879 * massMulti;
        } else if (objType = ObjType.Block) {
            w = 4.2 * scaleMulti;
            mass = 100 * massMulti;
        }

        // first use?
        if (objs.meshs[i] == null) {
            // create the mesh and rigid body
            objs.bodys[i] = new CANNON.Body({mass: mass, material: _this.Materials.objPhysMat});
            if (objType === ObjType.Tx) {
                objs.bodys[i].addShape(new CANNON.Sphere(w));
            } else if (objType === ObjType.Block) {
                objs.bodys[i].addShape(new CANNON.Box(new CANNON.Vec3(w / 2, w / 2, w / 2)));
            }
            objs.bodys[i].linearDamping = 0.15;
            objs.bodys[i].angularDamping = 0.2;
            _this.world.addBody(objs.bodys[i]);
            createMesh(objs, objType, i);
        } else {
            // repurpose the existing rigid body & mesh
            objs.bodys[i].shapes[0].radius = w;
            objs.bodys[i].shapes[0].boundingSphereRadius = w;
            objs.bodys[i].shapes[0].updateBoundingSphereRadius();
            objs.bodys[i].updateBoundingRadius();
            objs.bodys[i].updateMassProperties();
            objs.bodys[i].computeAABB();
            updateMesh(objs, objType, w, i);
        }

        if (objs.dynMeshs[i]) {
            // scale the outer mesh slightly larger so it's visible
            objs.dynMeshs[i].scale.set(w * 1.01, w * 1.01, w * 1.01);
            objs.dynMeshs[i].visible = true;
        }
        objs.meshs[i].scale.set(w, w, w);
        objs.meshs[i].visible = true;

        // randomize spawn pos
        if (objType === ObjType.Tx)
            objs.bodys[i].position.set(_this.RandRange(xSpawnVar), dropH + _this.RandRange(ySpawnVar), _this.RandRange(xSpawnVar));
        else if (objType === ObjType.Block)
            objs.bodys[i].position.set(_this.RandRange(xSpawnVar / 3), dropH - ySpawnVar, _this.RandRange(xSpawnVar / 3));

        objs.bodys[i].wakeUp();
        objs.bodys[i].velocity = new CANNON.Vec3(0, -dropForce, 0);

        if (objType === ObjType.Tx) {
            objs.bodys[i].angularVelocity = new CANNON.Vec3(_this.RandRange(aVel), _this.RandRange(aVel), _this.RandRange(aVel));
        }
        objs.active[i] = true;
        objs.objID[i] = objs.objLifetimeCount;
        objs.objLifetimeCount++;
        objs.objActiveCount++;

        if (objType === ObjType.Block) {
            // write text to the dyn mesh's material and activate bumpmap
            _this.Materials.WriteBlockText(objs.dynamicTextures[i], data);
            objs.dynMeshs[i].material.bumpMap = objs.dynamicTextures[i].texture;
            objs.dynMeshs[i].material.needsUpdate = true;
        }

        // collisions
        objs.bodys[i].addEventListener("collide", function (e) {
            var bdy = objs.bodys[i];
            var maxMag = 200;
            var mag = Math.sqrt(bdy.velocity.x * bdy.velocity.x
                + bdy.velocity.y * bdy.velocity.y
                + bdy.velocity.y * bdy.velocity.z);
            if (mag > 5 && objs.bodys[i].position.y < (dropH / 2)) {
                _this.Audio.Play(Math.max(Math.min(mag / maxMag, 1), 0.2), objs.data[i], objType === ObjType.Block);
            }
        });
    }

    function clearObjects(objs) {
        for (var i = 0; i < objs.active.length; i++) {
            removeObject(objs, i);
        }
    }

    function createMesh(objs, objType, i) {

        if (objType === ObjType.Tx) {

            objs.mats[i] = getTXMat(objs, i);
            objs.meshs[i] = new THREE.Mesh(getTXGeom(objs.data[i]), objs.mats[i]);

        } else if (objType === ObjType.Block) {

            // create dynamic tex
            objs.dynamicTextures[i] = new THREEx.DynamicTexture(256, 256);
            objs.mats[i] = _this.Materials.GetTextMat(objs.dynamicTextures[i]);

            // additional outer mesh to apply the dynamic tex on
            objs.dynMeshs[i] = new THREE.Mesh(_this.Materials.geomCube, objs.mats[i]);
            objs.dynMeshs[i].castShadow = false;
            objs.dynMeshs[i].receiveShadow = false;
            _this.scene.add(objs.dynMeshs[i]);

            _this.Materials.geomCube.uvsNeedUpdate = true;
            objs.meshs[i] = new THREE.Mesh(_this.Materials.geomCube, _this.Materials.matBlock);
        }
        _this.scene.add(objs.meshs[i]);
        objs.meshs[i].castShadow = !_this.Set.isMobile;
        objs.meshs[i].receiveShadow = _this.Set.isMobile ? false : (objType === ObjType.Block);
    }

    function updateObjects(objs) {
        if (objs) {
            for (var i = 0; i < objs.meshs.length; i++) {
                if (objs.active[i] === true) {
                    // sync bodies to meshes
                    if (objs.bodys[i]) {
                        objs.meshs[i].position.copy(objs.bodys[i].position);
                        if (objs.dynMeshs[i]) {
                            objs.dynMeshs[i].position.copy(objs.bodys[i].position);
                            objs.dynMeshs[i].quaternion.copy(objs.bodys[i].quaternion);
                        }
                        objs.meshs[i].quaternion.copy(objs.bodys[i].quaternion);
                        if (objs.meshs[i].position.y < -300) {
                            removeObject(objs, i);
                        }
                    }
                }
            }
        }
    }

    function removeObject(objs, i) {
        objs.active[i] = false;
        objs.objActiveCount--;
        objs.bodys[i].sleep();
        objs.bodys[i].position.set(0, 200, 0);
        objs.meshs[i].visible = false;
        objs.meshs[i].geometry.dispose();
        objs.mats[i].dispose();
        if (objs.dynMeshs[i]) objs.dynMeshs[i].visible = false;
    }

    function updateMesh(objs, objType, w, i) {
        if (objType === ObjType.Tx) {
            objs.meshs[i].geometry.dispose();
            objs.meshs[i].geometry = getTXGeom(objs.data[i]);
            objs.mats[i] = getTXMat(objs, i);
            objs.meshs[i].material = objs.mats[i];
            objs.meshs[i].material.needsUpdate = true;
        } else if (objType === ObjType.Block) {
            objs.dynamicTextures[i].context.clearRect(0, 0, 256, 256);
            objs.dynamicTextures[i].texture.needsUpdate = true;
        }
    }

    function getTXMat(objs, i) {
        if (objs.data[i] < 1) {
            return _this.Materials.matSwatch;
        } else if (objs.data[i] < 10) {
            return _this.Materials.matTXTex2;
        } else {
            return _this.Materials.matTXTex;
        }
    }
};

DashMachine.prototype.materials = function (_this) {

    var imgBlock = document.createElement('img');

    this.matBlock = loadMat('assets/textures/block.png');
    this.matTXTex = loadMat('assets/textures/tx.png');
    this.matTXTex2 = loadMat('assets/textures/tx2.png');
    this.matPlinth = loadMat('assets/textures/plinth.png');
    this.matPlinth2 = loadMat('assets/textures/plinth2.png');
    this.matSwatch = loadMat('assets/textures/swatch-blue.png');
    this.geomCube = new THREE.BoxGeometry(1, 1, 1);
    this.groundPhysMat = new CANNON.Material("groundPhysMat");
    this.objPhysMat = new CANNON.Material("objPhysMat");

    this.Init = function () {
        // obj contact with ground
        _this.world.addContactMaterial(new CANNON.ContactMaterial(_this.Materials.objPhysMat, _this.Materials.groundPhysMat, {
            friction: 0.00175,
            frictionEquationStiffness: 1e8,
            restitution: 0.0035,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 4.5
        }));

        // obj contact with obj
        _this.world.addContactMaterial(new CANNON.ContactMaterial(_this.Materials.objPhysMat, _this.Materials.objPhysMat, {
            friction: 0.35,
            frictionEquationStiffness: 1e6,
            restitution: 0.075,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3
        }));
    };

    this.GetGradTex = function (color) {

        if (_this.Set.isMobile) {
            return new THREE.DataTexture(1,1,1, THREE.RGBFormat );
        } else {
            var c = document.createElement("canvas");
            var ct = c.getContext("2d");
            var size = 128;
            c.width = 2;
            c.height = size;
            var gradient = ct.createLinearGradient(0, 0, 0, size);
            var i = color[0].length;
            while (i--) {
                gradient.addColorStop(color[0][i], color[1][i]);
            }
            ct.fillStyle = gradient;
            ct.fillRect(0, 0, 16, size);
            var texture = new THREE.Texture(c);
            texture.needsUpdate = true;
            return texture;
        }
    };

    this.WriteBlockText = function (tex, blockHeight) {
        tex.drawImage(imgBlock, 0, 0).drawTextCooked({
            text: _this.UI.FormatCurrency(blockHeight, 0, '.', ','),
            lineHeight: 0.15,
            //font: (0.15 * 256) + "px Dash Font",
            font: "bold " + (0.15 * 256) + "px Arial",
            align: 'center',
            fillStyle: '#ffffff',
        });
    };

    this.GetTextMat = function (map) {

        if (_this.Set.isMobile) {
            return new THREE.MeshLambertMaterial({
                map: map.texture,
                color: 0xbbbbbb,
                side: THREE.FrontSide,
                transparent: true
            });
        } else {
            return new THREE.MeshPhongMaterial({
                map: map.texture,
                color: 0xbbbbbb,
                specular: 0xbbbbbb,
                shininess: 500,
                side: THREE.FrontSide,
                transparent: true
            });
        }
    };

    function loadMat(img) {
        var texloader = new THREE.TextureLoader();
        var tmap = texloader.load(img);
        tmap.generateMipmaps = true;
        tmap.magFilter = tmap.minFilter = THREE.LinearFilter;

        if (_this.Set.isMobile) {
            return new THREE.MeshLambertMaterial({
                map: tmap,
                color: 0xaaaaaa,
                side: THREE.FrontSide
            });
        } else {
            return new THREE.MeshPhongMaterial({
                map: tmap,
                color: 0xaaaaaa,
                specular: 0x888888,
                shininess: 500,
                bumpMap: tmap,
                bumpScale: 0.9,
                side: THREE.FrontSide
            });
        }
    }
};

DashMachine.prototype.settings = function (_this) {

    var qualityLevels = {lo: 0, mid: 1, hi: 2};

    this.TimeStep = null;
    this.QualityLevels = qualityLevels;

    this.Init = function () {
        _this.Settings.SetQuality(qualityLevels.mid);
    };

    this.AutoSetQuality = function (fps) {
        if (fps < 20) {
            bumpQuality(false);
        } else if (fps > 45) {
            bumpQuality(true);
        }
    };

    function bumpQuality(up) {
        if (up) {
            if (_this.QualityLevel === qualityLevels.mid) _this.Settings.SetQuality(qualityLevels.hi);
            else if (_this.QualityLevel === qualityLevels.lo) _this.Settings.SetQuality(qualityLevels.mid);
            else if (_this.QualityLevel === qualityLevels.hi) _this.Settings.SetQuality(qualityLevels.lo);
        } else {
            if (_this.QualityLevel === qualityLevels.hi) _this.Settings.SetQuality(qualityLevels.mid);
            else if (_this.QualityLevel === qualityLevels.mid) _this.Settings.SetQuality(qualityLevels.lo);
        }
    }

    this.CycleQuality = function () {
        bumpQuality(true);
    };

    this.SetQuality = function (quality) {
        _this.QualityLevel = quality;
        if (_this.QualityLevel === qualityLevels.lo) {
            setPhysics(30, -20, true, 5, 1, false);
            _this.Set.spotLight.visible = true;
            _this.Set.spotLight2.visible = _this.Set.spotLight3.visible = _this.Set.spotLight4.visible = false;
        } else {
            _this.Set.spotLight.visible = false;
            if (_this.QualityLevel === qualityLevels.mid) {
                setPhysics(60, -90, false, 2, 6, true);
                setLight(_this.Set.spotLight2, true, true);
                setLight(_this.Set.spotLight3, false, false);
                setLight(_this.Set.spotLight4, false, false);
            } else {
                setPhysics(80, -150, false, 0, 8, true);
                setLight(_this.Set.spotLight2, false, false);
                setLight(_this.Set.spotLight3, true, true);
                setLight(_this.Set.spotLight4, true, true);
            }
        }
        _this.Objects.ResetGeom();
    };

    function setLight(l, vis, shad) {
        l.visible = vis;
        l.castShadow = _this.Set.isMobile ? false : shad;
    }

    function setPhysics(timeStep, gravity, fastNormalize, skip, iterations, shadow) {
        shadow = _this.Set.isMobile ? false : shadow;
        _this.renderer.shadowMap.enabled = _this.renderer.antialias = shadow;
        _this.Settings.TimeStep = 1 / timeStep;
        _this.world.gravity.set(0, gravity, 0);
        _this.world.broadphase = new CANNON.NaiveBroadphase();
        _this.world.solver.tolerance = 0.001;
        _this.world.quatNormalizeFast = fastNormalize;
        _this.world.quatNormalizeSkip = skip;
        _this.world.solver.iterations = iterations;
    }
};

DashMachine.prototype.ui = function (_this) {

    var UIStates = {loading: 0, play: 1};
    var UIState = UIStates.loading;
    var fadeTime = 25;
    var s = 0.1;
    var op = 1;
    var fadeTimer = null;

    this.Init = function () {
        window.addEventListener('keydown', function (e) {
            switch (e.keyCode) {
                case 65: /*a*/
                    _this.Audio.Mute = !_this.Audio.Mute;
                    console.log('muted = ' + _this.Audio.Mute);
                    break;
                case 81: /*q*/
                    if (!e.ctrlKey) {
                        _this.Settings.CycleQuality();
                        break;
                    }
            }
        }, false);
    };

    this.ShowLoader = function (show) {
        if (UIState === UIStates.loading && show) return;
        if (UIState === UIStates.play && !show) return;
        if (_this.options.blocker)
            fade(_this.options.blocker, show);
    };

    this.SetBlockHeightText = function (height) {
        if (_this.options.bestBlockHeightText)
            _this.options.bestBlockHeightText.innerHTML = _this.UI.FormatCurrency(height, 0, '.', ',');
    };

    this.SetNextBlockTime = function (time) {
        if (_this.options.nextBlockTime) {
            _this.options.nextBlockTime.innerHTML = time;
        }
    };

    this.FormatCurrency = function (n, c, d, t) {
        var c = isNaN(c = Math.abs(c)) ? 2 : c,
            d = d == undefined ? "." : d,
            t = t == undefined ? "," : t,
            s = n < 0 ? "-" : "",
            i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c))),
            j = (j = i.length) > 3 ? j % 3 : 0;
        return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
    };

    function fade(el, fadeIn) {
        if (!el) return;
        if (fadeTimer === null) {
            el.style.display = 'block';
            fadeTimer = setInterval(function () {
                op = fadeIn ? s : 1 - s;
                if (s >= 1) {
                    clearInterval(fadeTimer);
                    fadeTimer = null;
                    if (!fadeIn) el.style.display = 'none';
                    s = 0.1;
                    UIState = fadeIn ? UIStates.loading : UIStates.play;
                    _this.Audio.Mute = fadeIn;
                }
                el.style.opacity = op;
                el.style.filter = 'alpha(opacity=' + op * 100 + ")";
                s += s * 0.1;
            }, fadeTime);
        }
    }
};

DashMachine.prototype.audio = function (_this) {

    var audioBias = 0.2;
    this.Mute = true;

    // Play sample based on obj type, size, collision magnitude
    this.Play = function (mag, size, isBlock) {
        if (_this.Audio.Mute) return;
        if (isBlock) blocks.PlayAudio(mag * 0.3);
        else if (size < 1) tx_small.PlayAudio(mag);
        else if (size < 10) tx_mid.PlayAudio(mag);
        else if (size < 100) tx_large.PlayAudio(mag);
        else  tx_xlarge.PlayAudio(mag);
    };

    // Multi-channel / multi-sample audio pool
    function AudioPool(channels, samples) {
        var pool = [];
        for (var i = 0; i < samples.length; i++) {
            pool[i] = [];
            for (var j = 0; j < channels; j++) {
                pool[i][j] = document.createElement('audio');
                pool[i][j].src = samples[i];
            }
        }
        this.PlayAudio = function (vol) {
            var i = Math.floor(Math.random() * pool.length);
            for (var j = 0; j < channels; j++) {
                if (pool[i][j].paused || pool[i][j].ended) {
                    pool[i][j].playbackRate = _this.RandRange(0.9, 1.1);
                    pool[i][j].volume = (vol || 0.5) * audioBias;
                    pool[i][j].play();
                    break;
                }
            }
        };
    }

    var tx_small = new AudioPool(3, [
        'assets/audio/367147__jrhodesza__pool-ball-hit.mp3',
        'assets/audio/367152__jrhodesza__pool-ball-sink.mp3',
        'assets/audio/350918__csaszi__billiard-pool-shots-csg3.mp3',
        'assets/audio/350918__csaszi__billiard-pool-shots-csg5.mp3'
    ]);

    var tx_mid = new AudioPool(3, [
        'assets/audio/350918__csaszi__billiard-pool-shots-csg1.mp3',
        'assets/audio/350918__csaszi__billiard-pool-shots-csg2.mp3',
        'assets/audio/350918__csaszi__billiard-pool-shots-csg4.mp3',
        'assets/audio/350918__csaszi__billiard-pool-shots-csg6.mp3'
    ]);

    var tx_large = new AudioPool(2, [
        'assets/audio/138401__cameronmusic__pool-shot.mp3',
        'assets/audio/369981__northern87__stone-dropping-to-ground-northern87-1.mp3'
    ]);

    var tx_xlarge = new AudioPool(2, [
        'assets/audio/138401__cameronmusic__pool-shot.mp3',
        'assets/audio/108615__juskiddink__billiard-balls-single-hit-dry.mp3',
        'assets/audio/108616__juskiddink__hard-pop2.mp3',
        'assets/audio/108615__juskiddink__billiard-balls-single-hit-dry3.mp3',
        'assets/audio/264879__mafon2__three-dull-thumps-with-hammer.mp3',
        'assets/audio/108615__juskiddink__billiard-balls-single-hit-dry4.mp3'
    ]);

    var blocks = new AudioPool(1, [
        'assets/audio/51462__andre-rocha-nascimento__basket-ball-03-drop-wav.mp3',
        'assets/audio/364932__newagesoup__hit-tap-strike-cardboard-box-13-times1.mp3',
        'assets/audio/364932__newagesoup__hit-tap-strike-cardboard-box-13-times2.mp3',
        'assets/audio/364932__newagesoup__hit-tap-strike-cardboard-box-13-times3.mp3',
        'assets/audio/364932__newagesoup__hit-tap-strike-cardboard-box-13-times4.mp3',
        'assets/audio/364932__newagesoup__hit-tap-strike-cardboard-box-13-times5.mp3'
    ]);
};

DashMachine.prototype.net = function (_this) {

    var lastConnected;

    this.Init = function () {
        // Add best block and its tx at start then keep checking
        // the server is still available at regular intervals
        pingBestBlock();
    };

    function pingBestBlock() {
        // Wait for enough inactivity
        if (lastConnected ? (new Date() - lastConnected > 30000) : true) {
            get("status?q=getBestBlockHash", function (res1) {
                // first ping?
                if (!_this.bestBlock)
                    get("block/" + res1.bestblockhash, function (res) {
                        if (res && !_this.bestBlock) {
                            getBlockTX(res);
                        }
                    });
            });
        }
        // keep pinging
        setTimeout(pingBestBlock, 5000);
    }

    function getBlockTX(block) {
        block.txAmount = [];
        var maxTx = Math.min(block.tx.length, 30);
        var cbCount = 0;
        var outCount = 0;
        // request amounts for each TXO based on the address
        for (var i = 0; i < maxTx; i++) {
            get("tx/" + block.tx[i], function (data) {
                cbCount++;
                if (data && !_this.bestBlock) {
                    for (var i = 0; i < data.vout.length; i++) {
                        outCount++;
                        block.txAmount[outCount - 1] = data.vout[i].value;
                        if (block.txAmount.length >= 100) {
                            _this.bestBlock = block;
                            break;
                        }
                    }
                    if (cbCount >= maxTx)
                        _this.bestBlock = block;
                }
            });
        }
    }

    // Wire websockets
    this.Listen = function () {

        var socket = io.connect(_this.options.apiURL, {
            transports: [
                'websocket',
                'flashsocket',
                'htmlfile',
                'xhr-polling',
                'jsonp-polling',
                'polling'
            ]
        });

        socket.on('connect', function () {
            socket.emit('subscribe', 'inv');
        });
        socket.on('block', function (data) {
            get("block/" + data, function (res) {
                _this.AddBlock(res);
            });
        });
        socket.on('tx', function (data) {
            setNetConnect();
            for (var i = 0; i < data.vout.length; i++)
                for (var prop in data.vout[i]) {
                    _this.Objects.AddTX(data.vout[i][prop] / 10000000);
                    break;
                }
        });
    };

    // xhr
    function get(url, cb) {
        url = _this.options.apiURL + 'api/' + url;
        var xhr = new XMLHttpRequest();
        if ("withCredentials" in xhr) {
            xhr.open('GET', url, true); // Browsers
        } else if (typeof XDomainRequest != "undefined") {
            xhr = new XDomainRequest(); // IE
            xhr.open('GET', url);
        } else  xhr = null;
        if (xhr) {
            xhr.onload = function () {
                setNetConnect();
                cb(JSON.parse(xhr.responseText));
            };
            xhr.onerror = function () {
                setNetErr();
                cb();
            };
            xhr.send();
        }
    }

    function setNetConnect() {
        lastConnected = new Date();
        if (_this.playMode === _this.PlayModes.play) _this.UI.ShowLoader(false);
    }

    function setNetErr() {
        // show the loader when no connection
        _this.UI.ShowLoader(true);
    }
};

module.exports = DashMachine;