// key helper
var keyStates = [];
var keyChangeTimes = [];

function pairToSign(a,b) {
    if (a && b) {
        return 0;
    }
    else if (a) {
        return -1;
    }
    else if (b) {
        return 1;
    }
    else {
        return 0;
    }
}
var getKeyState = function(a) {
    if (keyStates[a] == null) {
        keyStates[a] = false;
    }
    return keyStates[a];
}
var getKeyPair = function(a, b) {
    return pairToSign(getKeyState(a), getKeyState(b));
}

function getKeyChangeTime(a) {
    if (keyChangeTimes[a] == null) {
        keyChangeTimes[a] = 0;
    }
    return keyChangeTimes[a];  
}
var getKeyPairLastChangeTime = function(a, b) {
    return Math.max(getKeyChangeTime(a), getKeyChangeTime(b));
}

var getKeyPairPreviousValue = function(a, b) {
    if (keyChangeTimes[a] > keyChangeTimes[b]) {
        return pairToSign(!getKeyState(a), getKeyState(b));
    }
    else {
        return pairToSign(getKeyState(a), !getKeyState(b));
    }
}

var setupKeyHelper = function(timer) {
    window.addEventListener("keydown", function(ev) {
        var k = ev.key.toLowerCase();
        if (keyStates[k] == null || keyStates[k] == false) {
            keyStates[k] = true;
            keyChangeTimes[k] = timer();
        }
    });
    window.addEventListener("keyup", function(ev) {
        var k = ev.key.toLowerCase();
        if (keyStates[k] == null || keyStates[k] == true) {
            keyStates[k] = false;
            keyChangeTimes[k] = timer();
        }
    });
};