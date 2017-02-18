var canvas = new fabric.Canvas('c');

canvas.backgroundColor = "#000";
canvas.setWidth(1000);
canvas.setHeight(800);

var laserBody = new fabric.Rect({
    fill: "gray",
    width: 50,
    height: 20,
    originX: 'center',
    originY: 'center'
});

var laserBtn = new fabric.Rect({
    fill: "red",
    width: 10,
    height: 10,
    originX: 'center',
    originY: 'center'
});

var laser = new fabric.Group([laserBody, laserBtn], {
    left: 150,
    top: 200
});

var crystal = new fabric.Triangle({
    left: 300,
    top: 100,
    fill: 'white',
    width: 200,
    height: 200
});

var onlyRotationEnabled = {
    mt: false,
    mb: false,
    ml: false,
    mr: false,
    bl: false,
    br: false,
    tl: false,
    tr: false
};

// Disable all controls besides rotation
laser.setControlsVisibility(onlyRotationEnabled);
crystal.setControlsVisibility(onlyRotationEnabled);

laserBtn.on("mouse:down", function () {
});

canvas.add(laser);
canvas.add(crystal);

