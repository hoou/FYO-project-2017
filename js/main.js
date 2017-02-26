function App(canvasSelector) {
    var self = this;

    this.canvas = null;

    this.gui = null;

    this.lasers = [];
    this.prisms = [];

    this.showIntersections = false;

    this.init = function () {
        this.canvas = new fabric.Canvas(canvasSelector, {
            renderOnAddRemove: false,
            skipTargetFind: false,
            backgroundColor: "#000",
            preserveObjectStacking: true
        });

        //TODO just for testing
        this.canvas.on('mouse:down', function (e) {
            self.getMouseCoords(e);
        });

        this.resizeCanvas();

        this.gui = new Gui(self);

        this.addLaser();
        this.addPrism();
    };

    this.reset = function () {
        this.destroyIntersectionsAndSegments();
        this.lasers.forEach(function (laser) {
            self.canvas.remove(laser.entity);
        });
        this.lasers = [];
        this.prisms.forEach(function (prism) {
            self.canvas.remove(prism.entity);
        });
        this.prisms = [];

        this.canvas.renderAll();

        this.showIntersections = false;

        this.gui.reset();

        this.addLaser();
        this.addPrism();
    };

    this.addLaser = function () {
        if (this.lasers.length >= 5) {
            alert("Maximum 5 lasers allowed");
            return;
        }

        var newLaser = new Laser(this.lasers.length + 1);

        newLaser.entity.on("mousedown", function (e) {
            var innerTarget = newLaser.entity._searchPossibleTargets(e.e);
            if (innerTarget == newLaser.button) {
                newLaser.buttonToggle();
                self.redraw();
            }
        });

        newLaser.entity.on("moving", function () {
            if (newLaser.beam.getVisible()) {
                newLaser.entity.setCoords();
                newLaser.beam.move(newLaser.entity.left, newLaser.entity.top);
                self.redraw();
            }
        });

        newLaser.entity.on("rotating", function () {
            newLaser.beam.light.entity.setAngle(newLaser.entity.get("angle"));
            self.redraw();
        });

        this.lasers.push(newLaser);
        this.canvas.add(newLaser.entity);
        this.redraw();

        this.gui.addLaser(newLaser);
    };

    this.addPrism = function () {
        var newPrism = new Prism();
        newPrism.entity.on("moving", self.redraw);
        newPrism.entity.on("rotating", self.redraw);
        newPrism.entity.on("modified", self.redraw);
        this.prisms.push(newPrism);
        this.canvas.add(newPrism.entity);
        this.canvas.sendToBack(newPrism.entity);
        this.redraw();
    };

    this.findClosestIntersectionBetweenLightAndPrisms = function (light) {
        var closestIntersectionOfAll = null;
        this.prisms.forEach(function (prism) {
            var closestIntersectionWithOnePrism = light.findClosestIntersectionWithPrism(prism);
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

    this.destroyIntersectionsAndSegments = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.light.intersections.forEach(function (intersection) {
                self.canvas.remove(intersection);
            });
            laser.beam.light.intersections = [];

            laser.beam.light.segments.forEach(function (segment) {
                self.canvas.remove(segment);
            });
            laser.beam.light.segments = [];

            self.removeSpectrum(laser);
        })
    };

    this.removeSpectrum = function (laser) {
        laser.beam.spectrum.forEach(function (light) {
            light.intersections.forEach(function (intersection) {
                self.canvas.remove(intersection);
            });
            light.intersections = [];

            light.segments.forEach(function (segment) {
                self.canvas.remove(segment);
            });
            light.segments = [];
        });
    };

    this.destroySpectrum = function (laser) {
        this.removeSpectrum(laser);
        laser.beam.spectrum = [];
    };

    this.drawCircle = function (x, y, color) {
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

        if (this.showIntersections) {
            this.canvas.add(newCircle);
            this.drawCircle.drawn = true;
        } else {
            this.drawCircle.drawn = false;
        }

        return newCircle;
    };
    this.drawCircle.drawn = false;

    this.toggleIntersectionsVisibility = function () {
        if (this.showIntersections) {
            if (!this.drawCircle.drawn) {
                this.lasers.forEach(function (laser) {
                    laser.beam.light.intersections.forEach(function (intersection) {
                        self.canvas.add(intersection);
                    });
                    laser.beam.spectrum.forEach(function (light) {
                        light.intersections.forEach(function (intersection) {
                            self.canvas.add(intersection);
                        })
                    })
                });
                this.drawCircle.drawn = true;
            } else {
                this.lasers.forEach(function (laser) {
                    laser.beam.light.intersections.forEach(function (intersection) {
                        intersection.visible = true;
                    });
                    laser.beam.spectrum.forEach(function (light) {
                        light.intersections.forEach(function (intersection) {
                            intersection.visible = true;
                        })
                    })
                })
            }
        } else {
            this.lasers.forEach(function (laser) {
                laser.beam.light.intersections.forEach(function (intersection) {
                    intersection.visible = false;
                });
                laser.beam.spectrum.forEach(function (light) {
                    light.intersections.forEach(function (intersection) {
                        intersection.visible = false;
                    })
                })
            })
        }
        this.canvas.renderAll();
    };

    this.redraw = function () {
        self.destroyIntersectionsAndSegments();
        self.lasers.forEach(function (laser) {
            laser.beam.light.updateStroke();
            laser.beam.light.entity.setWidth(3000);
            laser.beam.light.segments.push(laser.beam.light.entity);

            if (!laser.beam.getVisible()) {
                self.canvas.renderAll();
                return;
            }

            var closestIntersection;

            self.prisms.forEach(function (prism) {
                prism.setCoords();
            });
            laser.beam.light.entity.setCoords();

            if (!(closestIntersection = self.findClosestIntersectionBetweenLightAndPrisms(laser.beam.light))) {
                self.canvas.add(laser.beam.light.entity);
                self.canvas.sendToBack(laser.beam.light.entity);
                self.canvas.renderAll();
                return;
            }

            laser.beam.light.entity.setWidth(laser.beam.light.entity.getCoords()[0].distanceFrom(closestIntersection));

            var firstIntersection = closestIntersection;

            laser.beam.spectrum.forEach(function (light) {
                // How much should new beam segment rotate
                var newAngle = light.wavelength / 100;

                light.entity.setLeft(firstIntersection.x);
                light.entity.setTop(firstIntersection.y);
                light.entity.setAngle(laser.beam.light.entity.get("angle") + newAngle);
                light.entity.setCoords();

                // light.clearIntersections();
                var firstIntersectionDrawn = self.drawCircle(firstIntersection.x, firstIntersection.y, 'red');
                light.intersections.push(firstIntersectionDrawn);

                // light.clearSegments();
                light.segments.push(light.entity);

                self.prisms.forEach(function (prism) {
                    prism.setCoords();
                });
                light.entity.setCoords();

                while (closestIntersection = self.findClosestIntersectionBetweenLightAndPrisms(light)) {
                    var circleDrawn = self.drawCircle(closestIntersection.x, closestIntersection.y, 'red');
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
                    self.canvas.remove(removedSegment);

                    var shortenLastSegment = new fabric.Line([0, 0, closestIntersection.distanceFrom(new fabric.Point(removedSegment.left, removedSegment.top)), 0], {
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
                    self.canvas.add(segment);
                });
            });
            self.canvas.add(laser.beam.light.entity);
            self.canvas.sendToBack(laser.beam.light.entity);
        });
        self.canvas.renderAll();
    };

    this.resizeCanvas = function () {
        if ($(window).width() < 800) {
            this.canvas.setWidth(800);
        } else {
            this.canvas.setWidth($(window).width());
        }

        if ($(window).height() < 600) {
            this.canvas.setHeight(600);
        } else {
            this.canvas.setHeight($(window).height());
        }
    };

    window.addEventListener("resize", function () {
        self.resizeCanvas();
    });

    //TODO just for testing
    this.getMouseCoords = function (event) {
        var pointer = this.canvas.getPointer(event.e);
        var posY = pointer.y;
        var posX = pointer.x;
        console.log(posX + ", " + posY);    // Log to console
    };

    // On construction call init method
    this.init();
}

function Laser(id) {
    var self = this;

    this.id = id;

    this.body = new fabric.Rect({
        width: 50,
        height: 20,
        originX: 'center',
        originY: 'center'
    });
    this.body.setGradient("fill", {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: this.body.height,
        colorStops: {
            0: '#666',
            0.3: "#fff",
            1: '#666'
        }
    });

    this.frontPart = new fabric.Rect({
        width: 5,
        height: 12,
        originX: 'center',
        originY: 'center',
        left: 27
    });
    this.frontPart.setGradient("fill", {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: this.frontPart.height,
        colorStops: {
            0: '#666',
            0.15: "#fff",
            1: '#666'
        }
    });

    this.beam = new LaserBeam();

    this.textLabel = new fabric.Text(id.toString(), {
        fontSize: 15,
        fontWeight: 'bold',
        fontFamily: 'Courier New',
        originX: 'left',
        originY: 'center',
        left: -20
    });

    this.colorLabel = new fabric.Rect({
        fill: "white",
        width: 5,
        height: 20,
        originX: 'left',
        originY: 'center',
        left: -30
    });

    this.button = new fabric.Circle({
        radius: 6,
        fill: "red",
        originX: 'center',
        originY: 'center',
        left: 10
    });
    this.button.setGradient("fill", {
        x1: 0,
        y1: 0,
        x2: this.button.width,
        y2: 10,
        colorStops: {
            0: '#f99',
            0.3: "#f00",
            0.6: "#f00",
            1: '#800'
        }
    });

    this.entity = new fabric.Group([this.body, this.button, this.colorLabel, this.textLabel, this.frontPart], {
        left: 150,
        top: 200,
        originX: 'center',
        originY: 'center',
        centeredRotation: false,
        snapAngle: 1
    });

    this.buttonToggle = function () {
        this.beam.toggleVisible();
        self.entity.setCoords();
        self.beam.move(self.entity.left, self.entity.top);
    };

    // http://stackoverflow.com/questions/34047094/fabricjs-catch-click-on-object-inside-group
    this.entity._searchPossibleTargets = function (e) {
        var pointer = this.canvas.getPointer(e, true);
        var i = this._objects.length,
            normalizedPointer = this.canvas._normalizePointer(this, pointer);

        while (i--) {
            if (this.canvas._checkTarget(normalizedPointer, this._objects[i])) {
                return this._objects[i];
            }
        }
        return null;
    };

    // Disable all controls besides rotation
    this.entity.setControlsVisibility({
        mt: false,
        mb: false,
        ml: false,
        mr: false,
        bl: false,
        br: false,
        tl: false,
        tr: false
    });
}

function LaserBeam(wavelength) {
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

    this.createSpectrum = function () {
        if (this.light.visibleLight) {
            var min = 400;
            var max = 700; //700
            var step = 20;
            for (var i = min; i <= max; i += step) {
                this.spectrum.push(new Light(i));
            }
        } else {
            // Light with just one wavelength
            this.spectrum.push(new Light(this.light.wavelength)); // Make a copy
        }
    };

    this.createSpectrum();
}

function Light(wavelength) {
    var self = this;

    this.visibleLight = true;

    this.wavelength = wavelength || 700;

    this.entity = new fabric.Line([0, 0, 3000, 0], {
        stroke: (wavelength ? self.wavelengthToColor(wavelength) : "white"),
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

    this.updateStroke = function () {
        if (this.visibleLight) {
            this.entity.setStroke("white");
        } else {
            this.entity.setStroke(this.wavelengthToColor(this.wavelength));
        }
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
            if (!self.isPointInsideCircle(testedPoint, new fabric.Point(lastIntersection.left, lastIntersection.top), lastIntersection.radius)) {
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

    this.isPointInsideCircle = function (point1, point2, r) {
        return point1.distanceFrom(point2) < r;
    };
}

// http://scienceprimer.com/javascript-code-convert-light-wavelength-color
Light.prototype.wavelengthToColor = function (wavelength) {
    var R,
        G,
        B,
        alpha;

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
};

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

    this.entity.setControlsVisibility({
        mt: false,
        mb: false,
        ml: false,
        mr: false,
        bl: false,
        br: false,
        tl: false,
        tr: false
    });

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

function Gui(app) {
    this.gui = null;
    this.lasersFolder = null;
    this.prismsFolder = null;

    this.init = function () {
        this.gui = new dat.GUI({width: 300});

        var generalFolder = this.gui.addFolder("General");

        generalFolder.add(app, "reset").name("Reset App");

        var showIntersectionsOption = generalFolder.add(app, "showIntersections");
        showIntersectionsOption.name("Show Intersections");
        showIntersectionsOption.onChange(function (value) {
            app.toggleIntersectionsVisibility();
        });

        this.lasersFolder = this.gui.addFolder('Lasers');
        this.lasersFolder.add(app, 'addLaser').name("Add New Laser");

        this.prismsFolder = this.gui.addFolder('Prisms');
        this.prismsFolder.add(app, 'addPrism').name("Add New Prism");

        //TODO maybe uncomment, dont know what is actually better :-)
        // generalFolder.open();
        // this.lasersFolder.open();
        // this.prismsFolder.open();
    };

    this.reset = function () {
        this.gui.destroy();
        this.init();
    };

    this.addLaser = function (laser) {
        var newFolder = this.lasersFolder.addFolder("Laser " + laser.id);
        var controller;
        var button = newFolder.add(laser.beam.light, "visibleLight");
        button.name("Visible Light");
        button.onChange(function (value) {
            if (value) {
                controller.domElement.style.pointerEvents = "none";
                controller.domElement.style.opacity = .5;
                laser.colorLabel.setFill("white");
            } else {
                controller.domElement.style.pointerEvents = "";
                controller.domElement.style.opacity = 1;
                laser.colorLabel.setFill(laser.beam.light.wavelengthToColor(laser.beam.light.wavelength));
            }
            laser.beam.light.updateStroke();
            app.destroySpectrum(laser);
            laser.beam.createSpectrum();
            app.redraw();
        });

        controller = newFolder.add(laser.beam.light, 'wavelength', 400, 700);
        controller.onChange(function (value) {
            laser.colorLabel.setFill(laser.beam.light.wavelengthToColor(value));
            laser.beam.light.updateStroke();
            app.destroySpectrum(laser);
            laser.beam.createSpectrum();
            app.redraw();
        });
        controller.name("Wavelength [nm]");
        controller.domElement.style.pointerEvents = "none";
        controller.domElement.style.opacity = .5;
    };

    this.init();
}
