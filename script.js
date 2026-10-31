let scene, camera, renderer, clock;
let loader, controls;
let zombies = [];
let bullets = [];
let trees = [];
let bushes = [];
let bloodParticles = [];
let stars = [];
let bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;

let playerHealth = 5;
let kills = 0;
let gameTime = 0;
let lastShootTime = 0;
const BLASTER_COOLDOWN = 500;
const FIST_COOLDOWN = 300;

// Стаміна та біг
let stamina = 100;
const maxStamina = 100;
let isRunning = false;
let staminaExhausted = false; // Блокування бігу при вичерпанні

let currentWeapon = 'blaster';
let weaponModel = null;
let fistModel = null;
let isAnimating = false;

let audioCtx = null;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let shiftPressed = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const healthEl = document.getElementById('health');
const staminaBarEl = document.getElementById('stamina-bar');
const weaponEl = document.getElementById('current-weapon');
const killsEl = document.getElementById('kills');
const timerEl = document.getElementById('timer');
const gameOverEl = document.getElementById('game-over');
const instructionsEl = document.getElementById('instructions');
const finalScoreEl = document.getElementById('final-score');
const finalTimeEl = document.getElementById('final-time');
const restartBtn = document.getElementById('restart-btn');
const highScoresList = document.getElementById('high-scores-list');
const gameOverScores = document.getElementById('game-over-scores');

function init() {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a140f);
    scene.fog = new THREE.FogExp2(0x0a140f, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    controls = new THREE.PointerLockControls(camera, document.body);

    instructionsEl.addEventListener('click', () => {
        initAudio();
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        instructionsEl.classList.add('hidden');
    });

    controls.addEventListener('unlock', () => {
        if (playerHealth > 0) instructionsEl.classList.remove('hidden');
    });

    scene.add(controls.getObject());
    controls.getObject().position.set(0, 1.6, 0);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    loader = new THREE.GLTFLoader();

    const ambientLight = new THREE.AmbientLight(0x334433, 1.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffaa55, 2.0);
    sunLight.position.set(60, 40, -60);
    scene.add(sunLight);

    createSkyAndStars();
    createRealisticForestAndGrass();
    loadWeapons();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', performAction);
    if (restartBtn) restartBtn.addEventListener('click', resetGame);

    updateLeaderboards();

    setInterval(spawnZombie, 4000);
    spawnZombie();

    animate();
}

function initAudio() {
    if (audioCtx) return;
    audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    bgMusic.play().catch(e => console.log("Audio play blocked"));
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();

    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);


    if (type === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'punch') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

}

function createSkyAndStars() {
    const skyGeo = new THREE.SphereGeometry(600, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x11221c, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    const starGeo = new THREE.BufferGeometry();
    const starCount = 300;
    const starPositions = [];
    for (let i = 0; i < starCount; i++) {
        starPositions.push((Math.random() - 0.5) * 900, Math.random() * 400 + 100, (Math.random() - 0.5) * 900);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
    stars.push({ mesh: starField, mat: starMat });
}

function createRealisticForestAndGrass() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f2615';
    ctx.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 30000; i++) {
        ctx.fillStyle = Math.random() > 0.3 ? '#14381c' : '#1e4d2b';
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 8);
    }

    const flowerColors = ['#ffffff', '#ffee55', '#ff55aa', '#55aaff'];
    for (let i = 0; i < 600; i++) {
        ctx.fillStyle = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    const grassTexture = new THREE.CanvasTexture(canvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(40, 40);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.85 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x24170b, roughness: 0.95 });
    const leavesMat1 = new THREE.MeshStandardMaterial({ color: 0x0f2d14, roughness: 0.8 });
    const leavesMat2 = new THREE.MeshStandardMaterial({ color: 0x18421e, roughness: 0.8 });

    for (let i = 0; i < 140; i++) {
        const x = (Math.random() - 0.5) * 180;
        const z = (Math.random() - 0.5) * 180;
        if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;

        const tree = new THREE.Group();
        const trunkHeight = 5 + Math.random() * 2;
        const trunkGeo = new THREE.CylinderGeometry(0.35, 0.6, trunkHeight, 7);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2;
        tree.add(trunk);

        const levels = 4;
        for (let l = 0; l < levels; l++) {
            const radius = (3.2 - l * 0.65) * (0.8 + Math.random() * 0.4);
            const height = 2.2;
            const mat = l % 2 === 0 ? leavesMat1 : leavesMat2;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), mat);
            leaves.position.y = (trunkHeight - 1.5) + l * 1.2;
            tree.add(leaves);
        }

        tree.position.set(x, 0, z);
        scene.add(tree);
        trees.push(tree);
    }

    const bushMat = new THREE.MeshStandardMaterial({ color: 0x17361a, roughness: 0.9 });
    for (let i = 0; i < 60; i++) {
        const bx = (Math.random() - 0.5) * 170;
        const bz = (Math.random() - 0.5) * 170;
        if (Math.abs(bx) < 6 && Math.abs(bz) < 6) continue;

        const bushGroup = new THREE.Group();
        for (let b = 0; b < 3; b++) {
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.7 + Math.random() * 0.5, 6, 6), bushMat);
            sphere.position.set((Math.random() - 0.5) * 0.6, 0.3 + b * 0.25, (Math.random() - 0.5) * 0.6);
            bushGroup.add(sphere);
        }
        bushGroup.position.set(bx, 0, bz);
        scene.add(bushGroup);
        bushes.push(bushGroup);
    }
}

function loadWeapons() {
    loader.load(
        'blaster.glb',
        function(gltf) {
            weaponModel = gltf.scene;
            weaponModel.scale.set(0.12, 0.12, 0.12);
            weaponModel.position.set(0.2, -0.18, -0.35);
            weaponModel.rotation.y = Math.PI;
            camera.add(weaponModel);
            scene.add(camera);
        },
        undefined,
        function() {
            const geo = new THREE.BoxGeometry(0.06, 0.06, 0.25);
            const mat = new THREE.MeshStandardMaterial({ color: 0x00ff66 });
            weaponModel = new THREE.Mesh(geo, mat);
            weaponModel.position.set(0.2, -0.15, -0.3);
            camera.add(weaponModel);
            scene.add(camera);
        }
    );

    const fistGeo = new THREE.BoxGeometry(0.1, 0.1, 0.15);
    const fistMat = new THREE.MeshStandardMaterial({ color: 0xcc9977 });
    fistModel = new THREE.Mesh(fistGeo, fistMat);
    fistModel.position.set(0.2, -0.25, -0.3);
    fistModel.visible = false;
    camera.add(fistModel);
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW':
            moveForward = true;
            break;
        case 'KeyS':
            moveBackward = true;
            break;
        case 'KeyA':
            moveLeft = true;
            break;
        case 'KeyD':
            moveRight = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            if (!staminaExhausted) shiftPressed = true;
            break;
        case 'Digit1':
            currentWeapon = 'blaster';
            weaponEl.textContent = 'BLASTER (1)';
            if (weaponModel) weaponModel.visible = true;
            if (fistModel) fistModel.visible = false;
            break;
        case 'Digit2':
            currentWeapon = 'fists';
            weaponEl.textContent = 'FISTS (2)';
            if (weaponModel) weaponModel.visible = false;
            if (fistModel) fistModel.visible = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW':
            moveForward = false;
            break;
        case 'KeyS':
            moveBackward = false;
            break;
        case 'KeyA':
            moveLeft = false;
            break;
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            shiftPressed = false;
            break;
    }
}

// --- РУХ ТА СПРИНТ ЗІ СТАМІНОЮ ---
function updatePlayerMovement(delta) {
    if (!controls.isLocked) return;

    // Визначення чи біжить гравець (натиснуто W + Shift + є стаміна + не виснажений)
    const isMoving = moveForward || moveBackward || moveLeft || moveRight;
    isRunning = isMoving && shiftPressed && !staminaExhausted && moveForward; // Біг тільки вперед з Shift

    if (isRunning) {
        stamina -= delta * 35; // Витрата стаміни
        if (stamina <= 0) {
            stamina = 0;
            staminaExhausted = true; // Виснаження: заборона бігу поки не відновиться
        }
    } else {
        // Відновлення стаміни, коли не біжимо
        stamina += delta * 20;
        if (stamina >= maxStamina) {
            stamina = maxStamina;
            staminaExhausted = false; // Знімаємо блокування
        }
    }

    // Оновлення ширини полоси стаміни в UI
    if (staminaBarEl) {
        staminaBarEl.style.width = `${(stamina / maxStamina) * 100}%`;
    }

    // Швидкість пересування (якщо біжить — у 2.5 рази швидше)
    const speedMultiplier = isRunning ? 2.5 : 1.0;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 18.0 * speedMultiplier * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 18.0 * speedMultiplier * delta;

    const oldPos = controls.getObject().position.clone();
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    const newPos = controls.getObject().position;

    for (let tree of trees) {
        const dist = new THREE.Vector2(newPos.x - tree.position.x, newPos.z - tree.position.z).length();
        if (dist < 0.8) {
            newPos.x = oldPos.x;
            newPos.z = oldPos.z;
            break;
        }
    }

    if (newPos.x < -95) newPos.x = -95;
    if (newPos.x > 95) newPos.x = 95;
    if (newPos.z < -95) newPos.z = -95;
    if (newPos.z > 95) newPos.z = 95;
}

function spawnZombie() {
    if (playerHealth <= 0) return;

    const playerPos = controls.getObject().position;
    const angle = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 15;
    const spawnX = playerPos.x + Math.sin(angle) * dist;
    const spawnZ = playerPos.z + Math.cos(angle) * dist;

    loader.load(
        'zoombie.glb',
        function(gltf) {
            const zombie = gltf.scene;
            zombie.scale.set(0.55, 0.55, 0.55);
            zombie.position.set(spawnX, 0, spawnZ);

            let mixer = null;
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(zombie);
                const action = mixer.clipAction(gltf.animations[0]);
                action.play();
            }

            zombie.userData = { hp: 3, lastAttackTime: 0, mixer: mixer, state: 'walk' };
            scene.add(zombie);
            zombies.push(zombie);
        },
        undefined,
        function() {
            createFallbackZombie(spawnX, spawnZ);
        }
    );
}

function createFallbackZombie(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x1b4d2b }));
    body.position.y = 0.5;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0x77aa77 }));
    head.position.y = 1.15;
    group.add(head);

    group.position.set(x, 0, z);
    group.userData = { hp: 3, lastAttackTime: 0, mixer: null, state: 'walk' };
    scene.add(group);
    zombies.push(group);
}

function createBloodSplatter(pos) {
    const particleCount = 12;
    const pGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xcc0000 });

    for (let i = 0; i < particleCount; i++) {
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.copy(pos);
        p.position.y += 1;
        scene.add(p);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.2 + 0.1,
            (Math.random() - 0.5) * 0.3
        );
        bloodParticles.push({ mesh: p, velocity: velocity, life: 30 });
    }
}

function performAction() {
    if (!controls.isLocked || playerHealth <= 0 || isAnimating) return;

    const currentTime = Date.now();

    if (currentWeapon === 'blaster') {
        if (currentTime - lastShootTime < BLASTER_COOLDOWN) return;
        lastShootTime = currentTime;
        playSound('laser');

        if (weaponModel) {
            isAnimating = true;
            weaponModel.position.z += 0.05;
            setTimeout(() => {
                if (weaponModel) weaponModel.position.z -= 0.05;
                isAnimating = false;
            }, 100);
        }
        // Створюємо видовжений лазерний промінь (циліндр)
        const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
        laserGeo.rotateX(Math.PI / 2); // Повертаємо уздовж осі
        const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
        const bullet = new THREE.Mesh(laserGeo, laserMat);

        bullet.position.copy(camera.position);
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        bullet.lookAt(bullet.position.clone().add(dir)); // Направляємо лазер вперед

        bullet.userData = { direction: dir, speed: 1.8, life: 60 };
        scene.add(bullet);
        bullets.push(bullet);
    } else if (currentWeapon === 'fists') {
        if (currentTime - lastShootTime < FIST_COOLDOWN) return;
        lastShootTime = currentTime;
        playSound('punch');

        if (fistModel) {
            isAnimating = true;
            fistModel.position.z -= 0.2;
            setTimeout(() => {
                if (fistModel) fistModel.position.z += 0.2;
                isAnimating = false;
            }, 120);
        }

        const playerPos = controls.getObject().position;
        zombies.forEach((z, index) => {
            const dist = z.position.distanceTo(playerPos);
            if (dist < 3.5) {
                z.userData.hp--;
                createBloodSplatter(z.position);
                if (z.userData.hp <= 0) {
                    scene.remove(z);
                    zombies.splice(index, 1);
                    kills++;
                    killsEl.textContent = kills;
                }
            }
        });
    }
}

// --- ОСНОВНИЙ ЦИКЛ ТА ЕФЕКТ ЗАДИХАННЯ ---
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    gameTime += delta;

    const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
    const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;

    // Ефект задихання: чим менше стаміни, тим сильніше камера коливається (вдих/видих)
    if (stamina < 50) {
        const fatigueFactor = (50 - stamina) / 50; // від 0 до 1
        camera.position.y = 1.6 + Math.sin(gameTime * (8 + fatigueFactor * 6)) * (0.015 * fatigueFactor);

        // Візуальний ефект: легке мерехтіння фону від втоми
        if (stamina < 20) {
            document.body.style.backgroundColor = Math.sin(gameTime * 15) > 0 ? '#0a0202' : '#010402';
        } else {
            document.body.style.backgroundColor = '#010402';
        }
    } else {
        camera.position.y = 1.6;
    }

    if (gameTime > 120 && stars[0].mat.opacity < 1) {
        stars[0].mat.opacity += delta * 0.05;
        scene.fog.color.lerp(new THREE.Color(0x020503), delta * 0.05);
        scene.background.lerp(new THREE.Color(0x020503), delta * 0.05);
    }

    for (let i = bloodParticles.length - 1; i >= 0; i--) {
        const bp = bloodParticles[i];
        bp.mesh.position.add(bp.velocity);
        bp.velocity.y -= 0.01;
        bp.life--;
        if (bp.life <= 0) {
            scene.remove(bp.mesh);
            bloodParticles.splice(i, 1);
        }
    }

    if (playerHealth > 0) {
        updatePlayerMovement(delta);
        updateBullets();
        updateZombies(delta);
    }

    renderer.render(scene, camera);
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.addScaledVector(b.userData.direction, b.userData.speed);
        b.userData.life--;

        for (let j = zombies.length - 1; j >= 0; j--) {
            const z = zombies[j];
            const dist = b.position.distanceTo(z.position.clone().add(new THREE.Vector3(0, 1, 0)));

            if (dist < 1.3) {
                z.userData.hp--;
                createBloodSplatter(z.position);
                playSound('hit');
                if (z.userData.hp <= 0) {
                    scene.remove(z);
                    zombies.splice(j, 1);
                    kills++;
                    killsEl.textContent = kills;
                }
                scene.remove(b);
                bullets.splice(i, 1);
                break;
            }
        }

        if (b.userData.life <= 0 && bullets[i]) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }
}

function updateZombies(delta) {
    const now = Date.now();
    const playerPos = controls.getObject().position;
    const isNight = gameTime > 120;

    zombies.forEach(z => {
        if (z.userData.mixer) z.userData.mixer.update(delta);

        const dx = playerPos.x - z.position.x;
        const dz = playerPos.z - z.position.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        let speed = isNight ? 0.055 : 0.03;
        if (dist2D < 18) {
            speed = isNight ? 0.08 : 0.055;
        }

        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        z.position.addScaledVector(dir, speed);
        z.lookAt(playerPos.x, z.position.y, playerPos.z);

        if (dist2D < 1.8) {
            if (now - z.userData.lastAttackTime > 1200) {
                playerHealth--;
                if (healthEl) healthEl.textContent = `${playerHealth}/5`;

                document.body.style.backgroundColor = '#550000';
                setTimeout(() => { document.body.style.backgroundColor = '#010402'; }, 100);

                z.userData.lastAttackTime = now;
                if (playerHealth <= 0) gameOver();
            }
        }
    });
}

function saveScore() {
    let scores = JSON.parse(localStorage.getItem('forest_survival_scores') || '[]');
    const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
    const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');

    scores.push({ kills: kills, time: `${mins}:${secs}`, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.kills - a.kills);
    scores = scores.slice(0, 5);

    localStorage.setItem('forest_survival_scores', JSON.stringify(scores));
}

function updateLeaderboards() {
    const scores = JSON.parse(localStorage.getItem('forest_survival_scores') || '[]');
    let html = '';
    if (scores.length === 0) {
        html = '<li>No games played yet</li>';
    } else {
        scores.forEach((s, idx) => {
            html += `<li>#${idx+1} — Kills: <b>${s.kills}</b> | Time: ${s.time} (${s.date})</li>`;
        });
    }
    highScoresList.innerHTML = html;
    gameOverScores.innerHTML = html;
}

function gameOver() {
    controls.unlock();
    saveScore();
    updateLeaderboards();

    finalScoreEl.textContent = kills;
    const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
    const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');
    finalTimeEl.textContent = `${mins}:${secs}`;

    gameOverEl.classList.remove('hidden');
}

function resetGame() {
    zombies.forEach(z => scene.remove(z));
    bullets.forEach(b => scene.remove(b));
    bloodParticles.forEach(bp => scene.remove(bp.mesh));
    zombies = [];
    bullets = [];
    bloodParticles = [];

    playerHealth = 5;
    kills = 0;
    gameTime = 0;
    stamina = 100;
    staminaExhausted = false;
    healthEl.textContent = '5/5';
    killsEl.textContent = '0';
    gameOverEl.classList.add('hidden');

    controls.getObject().position.set(0, 1.6, 0);
    controls.lock();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();