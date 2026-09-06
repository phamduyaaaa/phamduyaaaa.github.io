const bootScreen = document.getElementById('ros-boot-screen');
const terminal = bootScreen.querySelector('.terminal-content');

const bootLogs = [
    { type: 'info', msg: 'Initializing embedded compute node...' },
    { type: 'info', msg: 'Loading DDS configuration profiles...' },
    { type: 'info', msg: 'ROS_DOMAIN_ID=42. Connecting to ROS 2 Humble daemon...' },
    { type: 'info', msg: 'Found hardware: [Intel RealSense D435], [SICK Visionary-T]' },
    { type: 'warn', msg: 'LiDAR scan density low. Adjusting Cartographer filters...' },
    { type: 'info', msg: 'Starting lifecycle node /nav2_amcl' },
    { type: 'info', msg: 'Loading global costmap... SUCCESS' },
    { type: 'info', msg: 'Distributional RL Planner loaded (Q2 MethodX).' },
    { type: 'info', msg: 'System online. Activating interface...' }
];

let logIndex = 0;

function printLog() {
    if (logIndex < bootLogs.length) {
        const log = bootLogs[logIndex];
        const p = document.createElement('div');
        p.className = 'terminal-line';
        
        const time = new Date().toISOString().substring(11, 23);
        const typeClass = log.type === 'warn' ? 'warn' : 'info';
        const typeText = log.type === 'warn' ? '[WARN]' : '[INFO]';
        
        p.innerHTML = `<span class="timestamp">[${time}]</span><span class="${typeClass}">${typeText}</span><span class="highlight">${log.msg}</span>`;
        terminal.appendChild(p);
        
        logIndex++;
        setTimeout(printLog, Math.random() * 100 + 50); 
    } else {
        setTimeout(() => {
            bootScreen.classList.add('boot-complete');
            setTimeout(() => bootScreen.style.display = 'none', 600);
            runCypherEffect();
            window.dispatchEvent(new CustomEvent('boot:complete'));
        }, 300);
    }
}

function initBoot() {
    if(!sessionStorage.getItem('booted')) {
        setTimeout(printLog, 200);
        sessionStorage.setItem('booted', 'true');
    } else {
        bootScreen.style.display = 'none';
        runCypherEffect();
        window.dispatchEvent(new CustomEvent('boot:complete'));
    }
}

if (document.readyState === 'complete') {
    initBoot();
} else {
    window.addEventListener('load', initBoot, { once: true });
}

function runCypherEffect() {
    const target = document.querySelector('.hero-eyebrow');
    if (!target) return;
    
    target.classList.add('cypher-text');
    const finalString = "Robotics Software Engineer · Hanoi, Vietnam";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
    let iterations = 0;
    
    const interval = setInterval(() => {
        target.innerText = finalString.split("").map((letter, index) => {
            if(index < iterations) return finalString[index];
            return chars[Math.floor(Math.random() * chars.length)];
        }).join("");
        
        if(iterations >= finalString.length) clearInterval(interval);
        iterations += 1 / 3;
    }, 30);
}
