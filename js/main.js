// ----------------------------------------------------------------------------
//                                   Functions
// ----------------------------------------------------------------------------

function Laser(x, y) {
    var self = this;

    this.body = new fabric.Rect({
        fill: "gray",
        width: 50,
        height: 20,
        originX: 'center',
        originY: 'center'
    });

    this.button = new fabric.Rect({
        fill: "red",
        width: 10,
        height: 10,
        originX: 'center',
        originY: 'center'
    });

    this.beam = new LaserBeam();

    this.entity = new fabric.Group([this.body, this.button], {
        left: x || 150,
        top: y || 200,
        originX: 'center',
        originY: 'center',
        centeredRotation: false,
        snapAngle: 1
    });

    this.buttonToggle = function () {
        this.beam.entity.visible = !this.beam.entity.visible;
        if (!this.beam.entity.visible) {
            this.button.setFill("red");
            this.beam.entity.setVisible(false);
            this.beam.clearIntersections();
            this.beam.clearSegments();
        } else {
            this.button.setFill("green");
            this.beam.entity.setVisible(true);
            this.beam.checkIntersections();
        }
    };

    this.entity._searchPossibleTargets = function (e) {
        var pointer = canvas.getPointer(e, true);
        var i = canvas._objects.length,
            normalizedPointer = canvas._normalizePointer(this, pointer);

        while (i--) {
            if (canvas._checkTarget(normalizedPointer, this._objects[i])) {
                return this._objects[i];
            }
        }
        return null;
    };

    // Disable all controls besides rotation
    this.entity.setControlsVisibility(onlyRotationEnabledSettings);

    this.entity.on("mousedown", function (e) {
        var innerTarget = this._searchPossibleTargets(e.e);

        if (innerTarget == self.button) {
            self.buttonToggle();
        }
    });

    this.entity.on("moving", function (e) {
        this.setCoords();
        self.beam.move(self.entity.left, self.entity.top);
    });

    this.entity.on("rotating", function (e) {
        this.setCoords();
        self.beam.entity.setAngle(this.get('angle'));
        self.beam.entity.setCoords();
        self.beam.checkIntersections();
    });

    // Init laser beam position
    this.beam.move(this.entity.left, this.entity.top);
}

function LaserBeam() {
    var self = this;

    this.entity = new fabric.Line([0, 0, 3000, 0], {
        stroke: "white",
        strokeWidth: 1,
        visible: false,
        selectable: false,
        centeredRotation: false,
        originX: 'left',
        originY: 'top'
    });

    var originColor = this.entity.stroke;

    this.intersections = [];


    this.segments = [];

    this.move = function (x, y) {
        this.entity.setLeft(x);
        this.entity.setTop(y);
        this.entity.setCoords();
        this.checkIntersections();
    };

    this.checkIntersections = function () {
        if (this.entity.visible == false)
            return;

        // canvas.removeAllCircles();
        self.clearIntersections();
        self.clearSegments();
        self.segments.push(self.entity);

        // canvas.remove(this.polyBeam);
        this.entity.setStroke(originColor);

        prisms.setCoords();
        this.entity.setCoords();

        var closestIntersection;

        var count = 1;

        while (closestIntersection = this.findClosestIntersectionWithPrisms()) {
            //TODO this is just for safety reasons - remove it or make it feature
            if (count == 100) {
                break;
            }

            var circleDrawn = drawCircle(closestIntersection.x, closestIntersection.y, 'red');
            self.intersections.push(circleDrawn);

            // How much should new beam segment rotate
            var degrees = 20;

            var newBeamSegment = new fabric.Line([0, 0, 3000, 0], {
                stroke: 'blue',
                strokeWidth: 1,
                selectable: false,
                centeredRotation: false,
                originX: 'left',
                originY: 'top',
                left: closestIntersection.x,
                top: closestIntersection.y
            });

            newBeamSegment.setAngle(degrees + this.getLastSegment().getAngle());
            newBeamSegment.setCoords();

            var removedSegment = this.segments.pop();
            canvas.remove(removedSegment);

            var shortenLastSegment = new fabric.Line([0, 0, distance(removedSegment.left, removedSegment.top, closestIntersection.x, closestIntersection.y), 0], {
                stroke: 'blue',
                strokeWidth: 1,
                selectable: false,
                centeredRotation: false,
                originX: 'left',
                originY: 'top',
                left: removedSegment.left,
                top: removedSegment.top
            });

            shortenLastSegment.setAngle(removedSegment.getAngle());

            this.segments.push(shortenLastSegment, newBeamSegment);

            canvas.renderAll();

            count++;
        }

        // Draw all segments
        this.segments.forEach(function (segment) {
            canvas.add(segment);
        });

        // Send first beam segment(coming from laser body) to back, so it is not being seen in middle of body
        canvas.sendToBack(this.segments[0]);
    };


    this.findIntersectionWithLine = function (line) {
        var result = checkLineIntersection(this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, this.getLastSegment().aCoords.tr.x, this.getLastSegment().aCoords.tr.y, line.x1, line.y1, line.x2, line.y2);
        if (result && result.onLine1 && result.onLine2) {
            return result;
        } else {
            return null;
        }
    };

    this.clearIntersections = function () {
        this.intersections.forEach(function (intersection) {
            canvas.remove(intersection);
        });
    };

    this.clearSegments = function () {
        this.segments.forEach(function (segment) {
            canvas.remove(segment);
        });
        this.segments = [];
    };

    this.findClosestIntersectionWithPrism = function (prism) {
        var possibleIntersection1 = this.findIntersectionWithLine(prism.getFirstEdge());
        if (possibleIntersection1 && possibleIntersection1.x == Math.round(this.getLastSegment().aCoords.tl.x) && possibleIntersection1.y == Math.round(this.getLastSegment().aCoords.tl.y)) {
            possibleIntersection1 = null;
        } else if (possibleIntersection1 && isPointInsideCircle(possibleIntersection1.x, possibleIntersection1.y, this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, 5)) {
            possibleIntersection1 = null;
        }
        var possibleIntersection2 = this.findIntersectionWithLine(prism.getSecondEdge());
        if (possibleIntersection2 && possibleIntersection2.x == Math.round(this.getLastSegment().aCoords.tl.x) && possibleIntersection2.y == Math.round(this.getLastSegment().aCoords.tl.y)) {
            possibleIntersection2 = null;
        } else if (possibleIntersection2 && isPointInsideCircle(possibleIntersection2.x, possibleIntersection2.y, this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, 5)) {
            possibleIntersection2 = null;
        }
        var possibleIntersection3 = this.findIntersectionWithLine(prism.getThirdEdge());
        if (possibleIntersection3 && possibleIntersection3.x == Math.round(this.getLastSegment().aCoords.tl.x) && possibleIntersection3.y == Math.round(this.getLastSegment().aCoords.tl.y)) {
            possibleIntersection3 = null;
        } else if (possibleIntersection3 && isPointInsideCircle(possibleIntersection3.x, possibleIntersection3.y, this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, 5)) {
            possibleIntersection3 = null;
        }

        var closestIntersection = possibleIntersection1 ? possibleIntersection1 : (possibleIntersection2 ? possibleIntersection2 : (possibleIntersection3 ? possibleIntersection3 : null));
        if (closestIntersection == null)
            return null;

        if (possibleIntersection2 && (distance(this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, possibleIntersection2.x, possibleIntersection2.y) < distance(this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, closestIntersection.x, closestIntersection.y)))
            closestIntersection = possibleIntersection2;
        if (possibleIntersection3 && (distance(this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, possibleIntersection3.x, possibleIntersection3.y) < distance(this.getLastSegment().aCoords.tl.x, this.getLastSegment().aCoords.tl.y, closestIntersection.x, closestIntersection.y)))
            closestIntersection = possibleIntersection3;

        return closestIntersection;
    };

    this.findClosestIntersectionWithPrisms = function () {
        var closestIntersectionOfAll = null;
        prisms.forEach(function (prism) {
            if (self.getLastSegment().intersectsWithObject(prism.entity)) {
                var closestIntersectionWithOnePrism = self.findClosestIntersectionWithPrism(prism);
                // console.log(closestIntersectionWithOnePrism);
                if (closestIntersectionWithOnePrism) {
                    if (closestIntersectionOfAll) {
                        if (distance(self.getLastSegment().aCoords.tl.x, self.getLastSegment().aCoords.tl.y, closestIntersectionWithOnePrism.x, closestIntersectionWithOnePrism.y) < distance(self.getLastSegment().aCoords.tl.x, self.getLastSegment().aCoords.tl.y, closestIntersectionOfAll.x, closestIntersectionOfAll.y)) {
                            closestIntersectionOfAll = closestIntersectionWithOnePrism;
                        }
                    } else {
                        closestIntersectionOfAll = closestIntersectionWithOnePrism
                    }
                }
            }
        });
        return closestIntersectionOfAll;
    };

    this.getLastSegment = function () {
        return this.segments[this.segments.length - 1];
    };

    // Init segments array
    this.segments.push(this.entity);
}

function Prism(x, y) {
    this.entity = new fabric.Polyline([
        {x: 100, y: 0},
        {x: 200, y: 200},
        {x: 0, y: 200},
        {x: 100, y: 0}

    ], {
        left: x || 300,
        top: y || 100,
        stroke: 'white',
        fill: 'rgba(0,0,0,0)'
    });

    this.entity.setControlsVisibility(onlyRotationEnabledSettings);

    this.entity.on("moving", lasers.checkIntersections);
    this.entity.on("rotating", lasers.checkIntersections);
    this.entity.on("modified", lasers.checkIntersections);

    this.setCoords = function () {
        this.entity.setCoords();
    };

    this.getFirstEdge = function () {
        return {
            'x1': this.entity.oCoords.mt.x,
            'y1': this.entity.oCoords.mt.y,
            'x2': this.entity.aCoords.bl.x,
            'y2': this.entity.aCoords.bl.y
        }
    };

    this.getSecondEdge = function () {
        return {
            'x1': this.entity.oCoords.mt.x,
            'y1': this.entity.oCoords.mt.y,
            'x2': this.entity.aCoords.br.x,
            'y2': this.entity.aCoords.br.y
        }
    };

    this.getThirdEdge = function () {
        return {
            'x1': this.entity.oCoords.br.x,
            'y1': this.entity.oCoords.br.y,
            'x2': this.entity.aCoords.bl.x,
            'y2': this.entity.aCoords.bl.y
        }
    }
}

// http://jsfiddle.net/justin_c_rounds/Gd2S2/light/
function checkLineIntersection(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    var denominator, a, b, numerator1, numerator2, result = {
        x: null,
        y: null,
        onLine1: false,
        onLine2: false
    };
    denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
    if (denominator == 0) {
        return result;
    }
    a = line1StartY - line2StartY;
    b = line1StartX - line2StartX;
    numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
    numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
    a = numerator1 / denominator;
    b = numerator2 / denominator;

    // if we cast these lines infinitely in both directions, they intersect here:
    result.x = line1StartX + (a * (line1EndX - line1StartX));
    result.y = line1StartY + (a * (line1EndY - line1StartY));
    /*
     // it is worth noting that this should be the same as:
     x = line2StartX + (b * (line2EndX - line2StartX));
     y = line2StartX + (b * (line2EndY - line2StartY));
     */
    // if line1 is a segment and line2 is infinite, they intersect if:
    if (a > 0 && a < 1) {
        result.onLine1 = true;
    }
    // if line2 is a segment and line1 is infinite, they intersect if:
    if (b > 0 && b < 1) {
        result.onLine2 = true;
    }
    // if line1 and line2 are segments, they intersect if both of the above are true
    // return result;

    if (result.onLine1 && result.onLine2) {
        result.x = Math.round(result.x);
        result.y = Math.round(result.y);
        return result;
    }
    else
        return null;
}

// http://stackoverflow.com/questions/28986872/finding-distance-between-two-points-on-image-even-when-image-is-scaled
function distance(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function drawCircle(x, y, color) {
    var newCircle = new fabric.Circle({
        radius: 3,
        fill: color || 'blue',
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        selectable: false
    });

    canvas.add(newCircle);

    return newCircle;
}

function getMouseCoords(event) {
    var pointer = canvas.getPointer(event.e);
    var posY = pointer.y;
    var posX = pointer.x;
    console.log(posX + ", " + posY);    // Log to console
}

function isPointInsideCircle(x0, y0, x1, y1, r) {
    return distance(x0, y0, x1, y1) < r;
}

// ----------------------------------------------------------------------------
//                                   Usage
// ----------------------------------------------------------------------------

var canvas = new fabric.Canvas('c');

canvas.backgroundColor = "#000";
canvas.setWidth(1000);
canvas.setHeight(800);
canvas.preserveObjectStacking = true;
canvas.removeAllCircles = function () {
    var objects = canvas.getObjects();
    var numberOfObjects = objects.length;
    for (var i = 0; i < numberOfObjects; i++) {
        if (objects[i].get('type') == 'circle') {
            canvas.remove(objects[i]);
            i--;
            numberOfObjects--;
        }
    }
};

var onlyRotationEnabledSettings = {
    mt: false,
    mb: false,
    ml: false,
    mr: false,
    bl: false,
    br: false,
    tl: false,
    tr: false
};

var lasers = [];

var prisms = [];

lasers.checkIntersections = function (e) {
    lasers.forEach(function (laser) {
        laser.beam.checkIntersections(e);
    });
};

prisms.setCoords = function () {
    prisms.forEach(function (prism) {
        prism.setCoords();
    })
};
var laser1 = new Laser();
var laser2 = new Laser(200, 500);
var prism1 = new Prism();
var prism2 = new Prism(300, 400);

lasers.push(laser1, laser2);
prisms.push(prism1, prism2);

lasers.forEach(function (laser) {
    canvas.add(laser.entity);
});

prisms.forEach(function (prism) {
    canvas.add(prism.entity);
    canvas.sendToBack(prism.entity);
});

canvas.on('mouse:down', function (e) {
    getMouseCoords(e);
});

//listener for refraction slider change
$("#range_slider").on("input change", function () {
    refractionChange(this.value);
});

function refractionChange(value) {
    $("#index_value").text(value);
    console.log("Refraction change " + value);
}