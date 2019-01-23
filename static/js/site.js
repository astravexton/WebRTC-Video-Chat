var localVideo = document.getElementById("local");
var remoteVideo = document.getElementById("remote");
var callButton = document.getElementById("startcall");
var hangupButton = document.getElementById("hangup");
var myPeerConnection = null;
var connection = null;
var mediaConstraints = {
    audio: true,
    video: { width: 1080, height: 720 }
};
var peerConnectionConfig = {
    'iceServers': [
        {
            'urls': [
                'stun:webrtcweb.com:7788'
            ],
            'username': 'muazkh',
            'credential': 'muazkh'
        },
        {
            'urls': [
                'turn:turn.anyfirewall.com:443?transport=tcp', // coTURN 7788+8877
            ],
            'username': 'webrtc',
            'credential': 'webrtc'
        },
        {
            'urls': [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun.l.google.com:19302?transport=udp',
            ]
        }
    ]
};
var uuid = createUUID();

function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function sendToServer(msg) {
    var msgJSON = JSON.stringify(msg);
    connection.send(msgJSON);
}

function connect() {
    connection = new WebSocket("wss://" + document.location.host + "/ws");

    connection.onerror = function (evt) {
        console.log("onerror " + evt);
    };

    connection.onclose = function (evt) {
        console.log("onclose " + evt.reason);
    };

    connection.onmessage = function (evt) {
        console.log(evt.data);
        var msg = JSON.parse(evt.data);

        if (msg.self !== uuid) {

            switch (msg.type) {
                case "video-offer":
                    handleVideoOfferMsg(msg);
                    break;
                case "video-answer":
                    handleVideoAnswerMsg(msg);
                    break;
                case "new-ice-candidate":
                    handleNewICECandidateMsg(msg);
                    break;
                case "hang-up":
                    handleHandUpMsg(msg);
                    break;
                default:
                    console.log("Unknown type: " + msg.type);
            }
        }
    };
}

function createPeerConnection() {
    myPeerConnection = new RTCPeerConnection();
    myPeerConnection.onicecandidate = handleICECandidateEvent;
    myPeerConnection.onnremovestream = handleRemoveStreamEvent;
    myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
    myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
    myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
    myPeerConnection.ontrack = handleTrackEvent;
}

function handleNegotiationNeededEvent() {
    if (myPeerConnection.signalingState !== "stable") return;
    myPeerConnection.createOffer().then(function (offer) {
        return myPeerConnection.setLocalDescription(offer);
    }).then(function () {
        sendToServer({
            self: uuid,
            type: "video-offer",
            sdp: myPeerConnection.localDescription
        });
    }).catch(reportError);
}

function handleTrackEvent(event) {
    remoteVideo.srcObject = event.streams[0];
}

function handleRemoveStreamEvent(event) {
    closeVideoCall();
}

function handleICECandidateEvent(event) {
    if (event.candidate) {
        sendToServer({
            self: uuid,
            type: "new-ice-candidate",
            candidate: event.candidate
        });
    }
}

function handleICEConnectionStateChangeEvent(event) {
    switch (myPeerConnection.iceConnectionState) {
        case "closed":
        case "failed":
        case "disconnected":
            closeVideoCall();
            break;
    }
}

function handleSignalingStateChangeEvent(event) {
    switch (myPeerConnection.signalingState) {
        case "closed":
            closeVideoCall();
            break;
    }
}

function closeVideoCall() {
    if (myPeerConnection) {
        myPeerConnection.ontrack = null;
        myPeerConnection.onremovestream = null;
        myPeerConnection.onnicecandidate = null;
        myPeerConnection.oniceconnectionstatechange = null;
        myPeerConnection.onsignalingstatechange = null;
        myPeerConnection.onicegatheringstatechange = null;
        myPeerConnection.onnotificationneeded = null;

        if (remoteVideo.srcObject) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        if (localVideo.srcObject) {
            localVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        remoteVideo.srcObject = null;
        localVideo.srcObject = null;

        myPeerConnection.close();
        myPeerConnection = null;
    }
}

function handleHandUpMsg(msg) {
    closeVideoCall();
}

function hangUpCall() {
    closeVideoCall();
    sendToServer({
        self: uuid,
        type: "hang-up"
    });
}

function startVideoCall() {
    createPeerConnection();
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(function (localstream) {
        localVideo.srcObject = localstream;
        localstream.getTracks().forEach(track => myPeerConnection.addTrack(track, localstream));
    }).catch(handleGetUserMediaError);
}

function handleVideoOfferMsg(msg) {
    var localStream = null;
    createPeerConnection();
    var desc = new RTCSessionDescription(msg.sdp);
    myPeerConnection.setRemoteDescription(desc).then(function () {
        return navigator.mediaDevices.getUserMedia(mediaConstraints);
    }).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = localStream;
        localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream));
    }).then(function () {
        return myPeerConnection.createAnswer();
    }).then(function (answer) {
        return myPeerConnection.setLocalDescription(answer);
    }).then(function () {
        sendToServer({
            self: uuid,
            type: "video-answer",
            sdp: myPeerConnection.localDescription
        });
    }).catch(handleGetUserMediaError);
}

function handleVideoAnswerMsg(msg) {
    var desc = new RTCSessionDescription(msg.sdp);
    myPeerConnection.setRemoteDescription(desc).catch(reportError);
}

function handleNewICECandidateMsg(msg) {
    var candidate = new RTCIceCandidate(msg.candidate);
    myPeerConnection.addIceCandidate(candidate).catch(reportError);
}

function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            alert("Unable to open your call because no camera and/or microphone were found");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
            break;
    }
}

function reportError(errMsg) {
    console.log("Error: " + errMsg.name + ": " + errMsg.message);
}

callButton.addEventListener("click", function () {
    startVideoCall();
});

hangupButton.addEventListener("click", function () {
    hangUpCall();
});

connect();
