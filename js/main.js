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
        this.beam.toggleVisible();
        self.entity.setCoords();
        self.beam.move(self.entity.left, self.entity.top);
        this.beam.redraw();
    };

    // http://stackoverflow.com/questions/34047094/fabricjs-catch-click-on-object-inside-group
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
        if (self.beam.getVisible()) {
            self.entity.setCoords();
            self.beam.move(self.entity.left, self.entity.top);
            self.beam.redraw();
        }
    });

    this.entity.on("rotating", function (e) {
        self.beam.light.entity.setAngle(self.entity.get("angle"));
        self.beam.redraw();
    });
}

function LaserBeam(wavelength) {
    var self = this;

    var visible = false;

    this.spectrum = [];

    this.light = new Light(wavelength);

    this.move = function (x, y) {
        this.light.entity.setLeft(x);
        this.light.entity.setTop(y);
        this.light.entity.setCoords();
    };

    this.getVisible = function () {
        return visible;
    };

    this.toggleVisible = function () {
        visible = !visible;
        this.spectrum.forEach(function (light) {
            light.entity.visible = visible;
        });
        this.light.entity.visible = visible;
    };

    this.redraw = function () {
        this.light.clearIntersections();
        this.light.clearSegments();
        this.light.entity.setWidth(3000);
        this.light.segments.push(this.light.entity);

        if (!visible) {
            this.spectrum.forEach(function (light) {
                light.clearIntersections();
                light.clearSegments();
            });
            canvas.renderAll();
            return;
        }

        var closestIntersection;

        prisms.setCoords();
        this.light.entity.setCoords();

        if (!(closestIntersection = this.light.findClosestIntersectionWithPrisms())) {
            canvas.add(this.light.entity);
            canvas.sendToBack(this.light.entity);
            this.spectrum.forEach(function (light) {
                light.clearIntersections();
                light.clearSegments();
            });
            canvas.renderAll();
            return;
        }

        this.light.entity.setWidth(this.light.entity.getCoords()[0].distanceFrom(closestIntersection));

        var firstIntersection = closestIntersection;

        this.spectrum.forEach(function (light) {
            // How much should new beam segment rotate
            var newAngle = light.entity.wavelength / 100;

            light.entity.setLeft(firstIntersection.x);
            light.entity.setTop(firstIntersection.y);
            light.entity.setAngle(self.light.entity.get("angle") + newAngle);
            light.entity.setCoords();

            light.clearIntersections();
            var firstIntersectionDrawn = drawCircle(firstIntersection.x, firstIntersection.y, 'red');
            light.intersections.push(firstIntersectionDrawn);

            light.clearSegments();
            light.segments.push(light.entity);

            prisms.setCoords();
            light.entity.setCoords();

            while (closestIntersection = light.findClosestIntersectionWithPrisms()) {
                var circleDrawn = drawCircle(closestIntersection.x, closestIntersection.y, 'red');
                light.intersections.push(circleDrawn);

                var newBeamSegment = new fabric.Line([0, 0, 3000, 0], {
                    stroke: light.entity.stroke,
                    strokeWidth: 1,
                    selectable: false,
                    hasControls: false,
                    hasBorders: false,
                    hasRotatingPoint: false,
                    centeredRotation: false,
                    originX: 'left',
                    originY: 'top',
                    left: closestIntersection.x,
                    top: closestIntersection.y
                });

                newBeamSegment.setAngle(newAngle + light.getLastSegment().getAngle());
                newBeamSegment.setCoords();

                var removedSegment = light.segments.pop();
                canvas.remove(removedSegment);

                var shortenLastSegment = new fabric.Line([0, 0, distance(removedSegment.left, removedSegment.top, closestIntersection.x, closestIntersection.y), 0], {
                    stroke: removedSegment.stroke,
                    strokeWidth: 1,
                    selectable: false,
                    hasControls: false,
                    hasBorders: false,
                    hasRotatingPoint: false,
                    centeredRotation: false,
                    originX: 'left',
                    originY: 'top',
                    left: removedSegment.left,
                    top: removedSegment.top
                });

                shortenLastSegment.setAngle(removedSegment.getAngle());

                light.segments.push(shortenLastSegment, newBeamSegment);
            }
            // Draw all segments
            light.segments.forEach(function (segment) {
                canvas.add(segment);
            });
        });
        canvas.add(this.light.entity);
        canvas.sendToBack(this.light.entity);
        canvas.renderAll();
    };

    this.createSpectrum = function () {
        if (this.light.entity.wavelength == 0) {
            // Visible(white) light
            var min = 400;
            var max = 650; //650
            var step = 20;
            for (var i = min; i <= max; i += step) {
                this.spectrum.push(new Light(i));
            }
        } else {
            // Light with just one wavelength
            this.spectrum.push(new Light(this.light.entity.wavelength)); // Make a copy
        }
    };

    this.createSpectrum();
}

function Light(wavelength) {
    var self = this;

    this.entity = new fabric.Line([0, 0, 3000, 0], {
        wavelength: wavelength || 0,
        stroke: (wavelength && wavelength != 0 ? wavelengthToColor(wavelength) : "white"),
        strokeWidth: 1,
        selectable: false,
        hasControls: false,
        hasBorders: false,
        hasRotatingPoint: false,
        centeredRotation: false,
        originX: 'left',
        originY: 'top',
        top: 50
    });

    this.segments = [];

    this.intersections = [];

    this.clearSegments = function () {
        this.segments.forEach(function (segment) {
            canvas.remove(segment);
        });
        this.segments = [];
    };

    this.clearIntersections = function () {
        this.intersections.forEach(function (intersection) {
            canvas.remove(intersection);
        });
        this.intersections = [];
    };

    this.getLastSegment = function () {
        return this.segments[this.segments.length - 1];
    };

    this.findClosestIntersectionWithPrism = function (prism) {
        var lastSegmentCoords = this.getLastSegment().getCoords();
        var intersection = fabric.Intersection.intersectLinePolygon(lastSegmentCoords[0], lastSegmentCoords[1], prism.getPointsCoords());
        if (intersection.status === "Intersection") {
            var filteredIntersections = this.removePointsNearbyLastIntersection(intersection.points);
            if (filteredIntersections.length == 0)
                return null;
            return this.pickClosestPointTo(new fabric.Point(lastSegmentCoords[0].x, lastSegmentCoords[0].y), filteredIntersections);
        }
        else {
            return null;
        }
    };

    this.removePointsNearbyLastIntersection = function (array) {
        if (this.intersections.length == 0)
            return array;

        var newArray = [];
        array.forEach(function (testedPoint) {
            var lastIntersection = self.intersections[self.intersections.length - 1];
            if (!isPointInsideCircle(testedPoint.x, testedPoint.y, lastIntersection.left, lastIntersection.top, lastIntersection.radius)) {
                newArray.push(testedPoint);
            }
        });
        return newArray;
    };

    this.pickClosestPointTo = function (point, array) {
        var closest = array[0];
        var distance = point.distanceFrom(closest);
        array.forEach(function (secondPoint) {
            var secondDistance;
            if ((secondDistance = point.distanceFrom(secondPoint)) < distance) {
                closest = secondPoint;
                distance = secondDistance;
            }
        });
        return {
            point: closest,
            distance: distance
        };
    };

    this.findClosestIntersectionWithPrisms = function () {
        var closestIntersectionOfAll = null;
        prisms.forEach(function (prism) {
            var closestIntersectionWithOnePrism = self.findClosestIntersectionWithPrism(prism);
            if (closestIntersectionWithOnePrism) {
                if (closestIntersectionOfAll) {
                    if (closestIntersectionWithOnePrism.distance < closestIntersectionOfAll.distance) {
                        closestIntersectionOfAll = closestIntersectionWithOnePrism;
                    }
                } else {
                    closestIntersectionOfAll = closestIntersectionWithOnePrism
                }
            }
        });
        return closestIntersectionOfAll ? closestIntersectionOfAll.point : null;
    };
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

    this.entity.on("moving", lasers.redraw);
    this.entity.on("rotating", lasers.redraw);
    this.entity.on("modified", lasers.redraw);

    this.setCoords = function () {
        this.entity.setCoords();
    };

    this.getPointsCoords = function () {
        return [
            new fabric.Point(this.entity.oCoords.br.x, this.entity.oCoords.br.y),
            new fabric.Point(this.entity.oCoords.bl.x, this.entity.oCoords.bl.y),
            new fabric.Point(this.entity.oCoords.mt.x, this.entity.oCoords.mt.y)
        ]
    }
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
        selectable: false,
        hasControls: false,
        hasBorders: false,
        hasRotatingPoint: false
    });

    //TODO make this an option
    // canvas.add(newCircle);

    return newCircle;
}

//TODO just for testing
function getMouseCoords(event) {
    var pointer = canvas.getPointer(event.e);
    var posY = pointer.y;
    var posX = pointer.x;
    console.log(posX + ", " + posY);    // Log to console
}

function isPointInsideCircle(x0, y0, x1, y1, r) {
    return distance(x0, y0, x1, y1) < r;
}

function resizeCanvas() {
    if ($(window).width() < 800) {
        canvas.setWidth(800);
    } else {
        canvas.setWidth($(window).width());
    }

    if ($(window).height() < 600) {
        canvas.setHeight(600);
    } else {
        canvas.setHeight($(window).height());
    }
}

// http://scienceprimer.com/javascript-code-convert-light-wavelength-color
function wavelengthToColor(wavelength) {
    var R,
        G,
        B,
        alpha,
        colorSpace,
        gamma = 1;

    if (wavelength >= 380 && wavelength < 440) {
        R = -1 * (wavelength - 440) / (440 - 380);
        G = 0;
        B = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
        R = 0;
        G = (wavelength - 440) / (490 - 440);
        B = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
        R = 0;
        G = 1;
        B = -1 * (wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        R = (wavelength - 510) / (580 - 510);
        G = 1;
        B = 0;
    } else if (wavelength >= 580 && wavelength < 645) {
        R = 1;
        G = -1 * (wavelength - 645) / (645 - 580);
        B = 0.0;
    } else if (wavelength >= 645 && wavelength <= 780) {
        R = 1;
        G = 0;
        B = 0;
    } else {
        R = 0;
        G = 0;
        B = 0;
    }

    // intensity is lower at the edges of the visible spectrum
    if (wavelength > 780 || wavelength < 380) {
        alpha = 0;
    } else if (wavelength > 700) {
        alpha = (780 - wavelength) / (780 - 700);
    } else if (wavelength < 420) {
        alpha = (wavelength - 380) / (420 - 380);
    } else {
        alpha = 1;
    }

    return "rgba(" + (R * 100) + "%," + (G * 100) + "%," + (B * 100) + "%, " + alpha + ")";
}

// ----------------------------------------------------------------------------
//                                   Usage
// ----------------------------------------------------------------------------

//TODO put this maybe in one class?? and make init function and functions to add lasers and prisms
var canvas = new fabric.Canvas('c', {renderOnAddRemove: false, skipTargetFind: false, backgroundColor: "#000", preserveObjectStacking: true});
canvas.removeAllCircles = function () {
    var objects = canvas.getObjects();
    var numberOfObjects = objects.length;
    for (var i = 0; i < numberOfObjects; i++) {
        if (objects[i].get('type') == 'daco') {
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

lasers.redraw = function (e) {
    lasers.forEach(function (laser) {
        laser.beam.redraw(e);
    });
};

prisms.setCoords = function () {
    prisms.forEach(function (prism) {
        prism.setCoords();
    })
};
var laser1 = new Laser();
// var laser2 = new Laser(200, 500);
var prism1 = new Prism();
var prism2 = new Prism(300, 400);

lasers.push(laser1);
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

resizeCanvas();

window.addEventListener("resize", function () {
    resizeCanvas();
});