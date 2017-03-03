function App(canvasSelector) {
    var self = this;

    this.canvas = null;

    this.gui = null;

    this.lasers = [];
    this.prisms = [];

    this.showIntersections = false;
    this.colorOfIntersections = "#000000";
    this.sizeOfIntersections = 0;

    this.showNormalVectors = false;
    this.colorOfNormalVectors = "#000000";
    this.widthOfNormalVectors = 0;
    this.lengthOfNormalVectors = 0;

    this.environmentElement = null;
    this.prismsElement = null;
    this.refractiveIndices = {};

    this.init = function () {
        this.canvas = new fabric.Canvas(canvasSelector, {
            renderOnAddRemove: false,
            skipTargetFind: false,
            backgroundColor: "#000",
            preserveObjectStacking: true,
            selection: false
        });

        //TODO just for testing
        this.canvas.on('mouse:down', function (e) {
            self.getMouseCoords(e);
        });

        this.resizeCanvas();

        this.loadRefractiveIndices();

        this.setupOptions();

        this.gui = new Gui(self);

        this.addLaser(100, 200);
        this.addPrism(300, 100);
    };

    this.reset = function () {
        this.destroyIntersectionsAndSegmentsAndNormals();
        this.lasers.forEach(function (laser) {
            self.canvas.remove(laser.entity);
        });
        this.lasers = [];
        this.prisms.forEach(function (prism) {
            self.canvas.remove(prism.entity);
        });
        this.prisms = [];

        this.setupOptions();

        this.canvas.renderAll();

        this.gui.reset();

        this.addLaser(100, 200);
        this.addPrism(300, 100);
    };

    this.setupOptions = function () {
        this.showIntersections = false;
        this.colorOfIntersections = "#ffff00";
        this.sizeOfIntersections = 3;

        this.showNormalVectors = false;
        this.colorOfNormalVectors = "#30ff76";
        this.widthOfNormalVectors = 1;
        this.lengthOfNormalVectors = 100;

        this.environmentElement = "air";
        this.prismsElement = "glass";
    };

    this.loadRefractiveIndices = function () {
        // https://refractiveindex.info/?shelf=other&book=air&page=Ciddor
        // standard air: dry air at 15 °C, 101.325 kPa and with 450 ppm CO2 content
        $.getJSON("js/refractive_indices/air.json", function (json) {
            self.refractiveIndices.air = json;
        });

        // https://refractiveindex.info/?shelf=main&book=H2O&page=Daimon-19.0C
        // distilled water at 19.0°C
        $.getJSON("js/refractive_indices/water.json", function (json) {
            self.refractiveIndices.water = json;
        });

        // https://refractiveindex.info/?shelf=glass&book=BK7&page=SCHOTT
        // BK7 glass
        $.getJSON("js/refractive_indices/glass.json", function (json) {
            self.refractiveIndices.glass = json;
        });
    };

    this.changeColorOfIntersections = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.spectrum.forEach(function (light) {
                light.intersections.forEach(function (intersection) {
                    intersection.setFill(self.colorOfIntersections);
                })
            })
        });
        this.canvas.renderAll();
    };

    this.changeSizeOfIntersections = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.spectrum.forEach(function (light) {
                light.intersections.forEach(function (intersection) {
                    intersection.setRadius(self.sizeOfIntersections);
                })
            })
        });
        this.canvas.renderAll();
    };

    this.changeColorOfNormalVectors = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.spectrum.forEach(function (light) {
                laser.beam.light.normalVectors.forEach(function (normalVector) {
                    normalVector.setStroke(self.colorOfNormalVectors);
                });
                light.normalVectors.forEach(function (normalVector) {
                    normalVector.setStroke(self.colorOfNormalVectors);
                })
            })
        });
        this.canvas.renderAll();
    };

    this.changeWidthOfNormalVectors = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.light.normalVectors.forEach(function (normalVector) {
                normalVector.setStrokeWidth(self.widthOfNormalVectors);
            });
            laser.beam.spectrum.forEach(function (light) {
                light.normalVectors.forEach(function (normalVector) {
                    normalVector.setStrokeWidth(self.widthOfNormalVectors);
                })
            })
        });
        this.canvas.renderAll();
    };

    this.changeLengthOfNormalVectors = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.light.normalVectors.forEach(function (normalVector) {
                normalVector.setWidth(self.lengthOfNormalVectors);
            });
            laser.beam.spectrum.forEach(function (light) {
                light.normalVectors.forEach(function (normalVector) {
                    normalVector.setWidth(self.lengthOfNormalVectors);
                })
            })
        });
        this.canvas.renderAll();
    };

    this.addLaser = function (x, y) {
        if (this.lasers.length >= 5) {
            alert("Maximum 5 lasers allowed");
            return;
        }

        var newLaser = new Laser(this.lasers.length + 1, x, y);

        newLaser.entity.on("mousedown", function (e) {
            var innerTarget = newLaser.entity._searchPossibleTargets(e.e);
            if (innerTarget == newLaser.button) {
                newLaser.buttonToggle();
                self.redraw();
            }
        });

        newLaser.entity.on("moving", function () {
            self.intersectingCheck(this);
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

        this.canvas.add(newLaser.entity);

        var shouldRemove = false;

        this.canvas.forEachObject(function (target) {
            if (target === newLaser.entity) return; //bypass self
            if (!target.name || (target.name != 'prism' && target.name != 'laser')) return;

            //check intersections with every object in canvas
            if (newLaser.entity.intersectsWithObject(target)
                || newLaser.entity.isContainedWithinObject(target)
                || target.isContainedWithinObject(newLaser.entity)) {
                shouldRemove = true;
            }
        });

        if (shouldRemove) {
            this.canvas.remove(newLaser.entity);
        }
        else {
            this.lasers.push(newLaser);
            this.gui.addLaser(newLaser);
            this.redraw();
        }
    };

    this.addPrism = function (x, y) {
        var newPrism = new Prism(x || 20, y || self.canvas.getHeight() - 220);
        newPrism.entity.on("moving", function () {
            self.intersectingCheck(this);
            self.redraw();
        });
        newPrism.entity.on("rotating", self.redraw);
        newPrism.entity.on("modified", self.redraw);

        this.canvas.add(newPrism.entity);

        var shouldRemove = false;

        this.canvas.forEachObject(function (target) {
            if (target === newPrism.entity) return; //bypass self
            if (!target.name || (target.name != 'prism' && target.name != 'laser')) return;

            //check intersections with every object in canvas
            if (newPrism.entity.intersectsWithObject(target)
                || newPrism.entity.isContainedWithinObject(target)
                || target.isContainedWithinObject(newPrism.entity)) {
                shouldRemove = true;
            }
        });

        if (shouldRemove) {
            this.canvas.remove(newPrism.entity);
        }
        else {
            this.prisms.push(newPrism);
            this.canvas.sendToBack(newPrism.entity);
            this.redraw();
        }
    };

    // http://jsfiddle.net/m0jjc23v/9/
    this.intersectingCheck = function (activeObject) {
        activeObject.setCoords();
        if (typeof activeObject.refreshLast != 'boolean') {
            activeObject.refreshLast = true
        }

        //loop canvas objects
        activeObject.canvas.forEachObject(function (target) {
            if (target === activeObject) return; //bypass self
            if (!target.name || (target.name != 'prism' && target.name != 'laser')) return; //check only prisms and lasers

            //check intersections with every object in canvas
            if (activeObject.intersectsWithObject(target)
                || activeObject.isContainedWithinObject(target)
                || target.isContainedWithinObject(activeObject)) {
                //objects are intersecting - deny saving last non-intersection position and break loop
                if (typeof activeObject.lastLeft == 'number') {
                    activeObject.left = activeObject.lastLeft;
                    activeObject.top = activeObject.lastTop;
                    activeObject.refreshLast = false;
                    return;
                }
            }
            else {
                activeObject.refreshLast = true;
            }
        });

        if (activeObject.refreshLast) {
            //save last non-intersecting position if possible
            activeObject.lastLeft = activeObject.left;
            activeObject.lastTop = activeObject.top;
        }
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

    this.destroyIntersectionsAndSegmentsAndNormals = function () {
        this.lasers.forEach(function (laser) {
            laser.beam.light.intersections.forEach(function (intersection) {
                self.canvas.remove(intersection);
            });
            laser.beam.light.intersections = [];

            laser.beam.light.segments.forEach(function (segment) {
                self.canvas.remove(segment);
            });
            laser.beam.light.segments = [];

            laser.beam.light.normalVectors.forEach(function (normalVector) {
                self.canvas.remove(normalVector);
            });
            laser.beam.light.normalVectors = [];

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

            light.normalVectors.forEach(function (normalVector) {
                self.canvas.remove(normalVector);
            });
            light.normalVectors = [];
        });
    };

    this.destroySpectrum = function (laser) {
        this.removeSpectrum(laser);
        laser.beam.spectrum = [];
    };

    this.makeIntersectionCircle = function (x, y) {
        var newCircle = new fabric.Circle({
            radius: self.sizeOfIntersections,
            fill: self.colorOfIntersections,
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
            this.makeIntersectionCircle.drawn = true;
        } else {
            this.makeIntersectionCircle.drawn = false;
        }

        return newCircle;
    };
    this.makeIntersectionCircle.drawn = false;

    this.toggleIntersectionsVisibility = function () {
        if (this.showIntersections) {
            if (!this.makeIntersectionCircle.drawn) {
                this.lasers.forEach(function (laser) {
                    laser.beam.spectrum.forEach(function (light) {
                        light.intersections.forEach(function (intersection) {
                            self.canvas.add(intersection);
                            self.canvas.bringToFront(intersection);
                        })
                    })
                });
                this.makeIntersectionCircle.drawn = true;
            } else {
                this.lasers.forEach(function (laser) {
                    laser.beam.spectrum.forEach(function (light) {
                        light.intersections.forEach(function (intersection) {
                            intersection.visible = true;
                            self.canvas.bringToFront(intersection);
                        })
                    })
                })
            }
        } else {
            this.lasers.forEach(function (laser) {
                laser.beam.spectrum.forEach(function (light) {
                    light.intersections.forEach(function (intersection) {
                        intersection.visible = false;
                    })
                })
            })
        }
        this.canvas.renderAll();
    };

    this.toggleNormalVectorsVisibility = function () {
        if (this.showNormalVectors) {
            this.lasers.forEach(function (laser) {
                laser.beam.light.normalVectors.forEach(function (normalVector) {
                    normalVector.visible = true;
                    self.canvas.sendToBack(normalVector);
                });
                laser.beam.spectrum.forEach(function (light) {
                    light.normalVectors.forEach(function (normalVector) {
                        normalVector.visible = true;
                        self.canvas.sendToBack(normalVector);
                    })
                })
            })
        } else {
            this.lasers.forEach(function (laser) {
                laser.beam.light.normalVectors.forEach(function (normalVector) {
                    normalVector.visible = false;
                });
                laser.beam.spectrum.forEach(function (light) {
                    light.normalVectors.forEach(function (normalVector) {
                        normalVector.visible = false;
                    })
                })
            })
        }
        this.canvas.renderAll();
    };

    this.redraw = function () {
        self.destroyIntersectionsAndSegmentsAndNormals();
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

            var firstNormalVector = self.makeNormalVector(firstIntersection, firstIntersection.line);
            laser.beam.light.normalVectors.push(firstNormalVector);
            self.canvas.add(firstNormalVector);

            laser.beam.spectrum.forEach(function (light) {
                // How much should new beam segment rotate
                var newAngle = light.wavelength / 100; //TODO use firstNormalVector to compute new angle

                light.entity.setLeft(firstIntersection.x);
                light.entity.setTop(firstIntersection.y);
                light.entity.setAngle(laser.beam.light.entity.get("angle") + newAngle);
                light.entity.setCoords();

                // light.clearIntersections();
                var firstIntersectionDrawn = self.makeIntersectionCircle(firstIntersection.x, firstIntersection.y);
                light.intersections.push(firstIntersectionDrawn);

                // light.clearSegments();
                light.segments.push(light.entity);

                self.prisms.forEach(function (prism) {
                    prism.setCoords();
                });
                light.entity.setCoords();

                while (closestIntersection = self.findClosestIntersectionBetweenLightAndPrisms(light)) {
                    var circleDrawn = self.makeIntersectionCircle(closestIntersection.x, closestIntersection.y);
                    light.intersections.push(circleDrawn);
                    var newNormalVector = self.makeNormalVector(closestIntersection, closestIntersection.line);
                    light.normalVectors.push(newNormalVector);
                    self.canvas.add(newNormalVector);

                    var newBeamSegment = new fabric.Line([0, 0, 3000, 0], {
                        stroke: light.entity.stroke,
                        strokeWidth: 2,
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

                    //TODO use newNormalVector to compute new angle
                    newBeamSegment.setAngle(newAngle + light.getLastSegment().getAngle());
                    newBeamSegment.setCoords();

                    var removedSegment = light.segments.pop();
                    self.canvas.remove(removedSegment);

                    var shortenLastSegment = new fabric.Line([0, 0, closestIntersection.distanceFrom(new fabric.Point(removedSegment.left, removedSegment.top)), 0], {
                        stroke: removedSegment.stroke,
                        strokeWidth: 2,
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

                if (self.showIntersections) {
                    light.intersections.forEach(function (intersection) {
                        self.canvas.bringToFront(intersection);
                    });
                }
                if (self.showNormalVectors) {
                    light.normalVectors.forEach(function (normalVector) {
                        normalVector.visible = true;
                        self.canvas.sendToBack(normalVector);
                    });
                }
            });
            self.canvas.add(laser.beam.light.entity);
            self.canvas.sendToBack(laser.beam.light.entity);
            if (self.showNormalVectors) {
                laser.beam.light.normalVectors.forEach(function (normalVector) {
                    normalVector.visible = true;
                    self.canvas.sendToBack(normalVector);
                });
            }
        });
        self.canvas.renderAll();
    };

    this.makeNormalVector = function (point, points) {
        var angle = maths.computeAngleBetweenTwoLines({x1: 0, y1: 0, x2: 1, y2: 0}, points);
        return new fabric.Line([0, 0, self.lengthOfNormalVectors, 0], {
            stroke: self.colorOfNormalVectors,
            strokeWidth: self.widthOfNormalVectors,
            strokeDashArray: [5, 5],
            visible: false,
            selectable: false,
            hasControls: false,
            hasBorders: false,
            hasRotatingPoint: false,
            centeredRotation: true,
            originX: 'center',
            originY: 'center',
            left: point.x,
            top: point.y,
            angle: angle + 90
        });
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
        // console.log(posX + ", " + posY);    // Log to console
    };

    // On construction call init method
    this.init();
}

function Laser(id, x, y) {
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
        left: x || 50,
        top: y || 20,
        originX: 'center',
        originY: 'center',
        centeredRotation: false,
        snapAngle: 1,
        name: 'laser'
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
        stroke: (wavelength ? maths.wavelengthToColor(wavelength) : "white"),
        strokeWidth: 2,
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

    this.normalVectors = [];

    this.updateStroke = function () {
        if (this.visibleLight) {
            this.entity.setStroke("white");
        } else {
            this.entity.setStroke(maths.wavelengthToColor(this.wavelength));
        }
    };

    this.getLastSegment = function () {
        return this.segments[this.segments.length - 1];
    };

    this.findClosestIntersectionWithPrism = function (prism) {
        var lastSegmentCoords = this.getLastSegment().getCoords();
        var intersection = maths.intersectLinePolygon(lastSegmentCoords[0], lastSegmentCoords[1], prism.getPointsCoords());
        if (intersection.status === "Intersection") {
            var filteredIntersections = this.removePointsNearbyLastIntersection(intersection.points);
            if (filteredIntersections.length == 0)
                return null;
            return maths.pickClosestPointTo(new fabric.Point(lastSegmentCoords[0].x, lastSegmentCoords[0].y), filteredIntersections);
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
            if (!maths.isPointInsideCircle(testedPoint, new fabric.Point(lastIntersection.left, lastIntersection.top), lastIntersection.radius)) {
                newArray.push(testedPoint);
            }
        });
        return newArray;
    };
}

function Prism(x, y) {
    this.entity = new fabric.Polyline([
        {x: 100, y: 0},
        {x: 200, y: 200},
        {x: 0, y: 200},
        {x: 100, y: 0}

    ], {
        left: x,
        top: y,
        stroke: 'white',
        fill: 'rgba(0,0,0,0)',
        name: 'prism'
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

    this.init = function () {
        this.gui = new dat.GUI({width: 420});

        var generalFolder = this.gui.addFolder("General");

        generalFolder.add(app, "reset").name("Reset App");

        var intersectionsFolder = this.gui.addFolder("Intersections");

        var showIntersectionsOption = intersectionsFolder.add(app, "showIntersections");
        showIntersectionsOption.name("Show Intersections");
        showIntersectionsOption.onChange(function (value) {
            app.toggleIntersectionsVisibility();
        });

        var colorOfIntersectionsController = intersectionsFolder.addColor(app, "colorOfIntersections");
        colorOfIntersectionsController.name("Color of Intersections");
        colorOfIntersectionsController.onChange(function (value) {
            app.changeColorOfIntersections();
        });

        var sizeOfIntersectionsController = intersectionsFolder.add(app, "sizeOfIntersections", 1, 6);
        sizeOfIntersectionsController.name("Size of Intersections");
        sizeOfIntersectionsController.onChange(function (value) {
            app.changeSizeOfIntersections();
        });

        var normalVectorsFolder = this.gui.addFolder("Normal vectors");

        var showNormalVectorsOption = normalVectorsFolder.add(app, "showNormalVectors");
        showNormalVectorsOption.name("Show Normal Vectors");
        showNormalVectorsOption.onChange(function (value) {
            app.toggleNormalVectorsVisibility();
        });

        var colorOfNormalVectorsController = normalVectorsFolder.addColor(app, "colorOfNormalVectors");
        colorOfNormalVectorsController.name("Color of Normal Vectors");
        colorOfNormalVectorsController.onChange(function (value) {
            app.changeColorOfNormalVectors();
        });

        var widthOfNormalVectorsController = normalVectorsFolder.add(app, "widthOfNormalVectors", 1, 6);
        widthOfNormalVectorsController.name("Width of Normal Vectors");
        widthOfNormalVectorsController.onChange(function (value) {
            app.changeWidthOfNormalVectors();
        });

        var lengthOfNormalVectorsController = normalVectorsFolder.add(app, "lengthOfNormalVectors", 1, 300);
        lengthOfNormalVectorsController.name("Length of Normal Vectors");
        lengthOfNormalVectorsController.onChange(function (value) {
            app.changeLengthOfNormalVectors();
        });

        var indexOfRefractionFolder = this.gui.addFolder("Index of Refraction");

        var environmentElementController = indexOfRefractionFolder.add(app, "environmentElement", ["air", "water", "glass"]);
        environmentElementController.name("Environment");
        environmentElementController.onChange(function (value) {
            app.redraw();
        });

        var prismsElementController = indexOfRefractionFolder.add(app, "prismsElement", ["air", "water", "glass"]);
        prismsElementController.name("Prisms");
        prismsElementController.onChange(function (value) {
            app.redraw();
        });

        this.lasersFolder = this.gui.addFolder('Lasers');
        this.lasersFolder.add(app, 'addLaser').name("Add New Laser");

        var prismsFolder = this.gui.addFolder('Prisms');
        prismsFolder.add(app, 'addPrism').name("Add New Prism");
    };

    this.reset = function () {
        this.gui.destroy();
        this.init();
    };

    this.addLaser = function (laser) {
        var newFolder = this.lasersFolder.addFolder("Laser " + laser.id);
        var controller;
        var button = newFolder.add(laser.beam.light, "visibleLight");
        button.name("White Light");
        button.onChange(function (value) {
            if (value) {
                controller.domElement.style.pointerEvents = "none";
                controller.domElement.style.opacity = .5;
                laser.colorLabel.setFill("white");
            } else {
                controller.domElement.style.pointerEvents = "";
                controller.domElement.style.opacity = 1;
                laser.colorLabel.setFill(maths.wavelengthToColor(laser.beam.light.wavelength));
            }
            laser.beam.light.updateStroke();
            app.destroySpectrum(laser);
            laser.beam.createSpectrum();
            app.redraw();
        });

        controller = newFolder.add(laser.beam.light, 'wavelength', 400, 700);
        controller.onChange(function (value) {
            laser.colorLabel.setFill(maths.wavelengthToColor(value));
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

(function (maths, $, undefined) {
    // http://stackoverflow.com/questions/9705123/how-can-i-get-sin-cos-and-tan-to-use-degrees-instead-of-radians
    maths.toDegrees = function (angle) {
        return angle * (180 / Math.PI);
    };

    // http://stackoverflow.com/questions/9705123/how-can-i-get-sin-cos-and-tan-to-use-degrees-instead-of-radians
    maths.toRadians = function (angle) {
        return angle * (Math.PI / 180);
    };

    // http://stackoverflow.com/questions/28466589/fabricjs-how-i-can-make-an-angle-measurement
    maths.computeAngleBetweenTwoLines = function (line1, line2) {
        var y11 = line1.y1;
        var y12 = line1.y2;
        var y21 = line2.y1;
        var y22 = line2.y2;

        var x11 = line1.x1;
        var x12 = line1.x2;
        var x21 = line2.x1;
        var x22 = line2.x2;

        var angle1 = Math.atan2(y11 - y12, x11 - x12);
        var angle2 = Math.atan2(y21 - y22, x21 - x22);

        var angle = angle1 - angle2;
        angle = maths.toDegrees(angle);
        if (angle < 0) angle = -angle;
        // if (360 - angle < angle) angle = 360 - angle;

        return 360 - angle;
    };

    maths.intersectLinePolygon = function (a1, a2, points) {
        var result = new fabric.Intersection(),
            length = points.length,
            b1, b2, inter;

        for (var i = 0; i < length; i++) {
            b1 = points[i];
            b2 = points[(i + 1) % length];
            inter = fabric.Intersection.intersectLineLine(a1, a2, b1, b2);
            if (inter.points.length > 0) {
                inter.points[0].line = {x1: b1.x, y1: b1.y, x2: b2.x, y2: b2.y};
            }
            result.appendPoints(inter.points);
        }
        if (result.points.length > 0) {
            result.status = 'Intersection';
        }
        return result;
    };

    maths.pickClosestPointTo = function (point, array) {
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

    maths.isPointInsideCircle = function (point1, point2, r) {
        return point1.distanceFrom(point2) < r;
    };

    // http://scienceprimer.com/javascript-code-convert-light-wavelength-color
    maths.wavelengthToColor = function (wavelength) {
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

    maths.computeAngleUsingSnellLaw = function (t1, n1, n2) {
        return maths.toDegrees(Math.asin((n1 * Math.sin(maths.toRadians(t1))) / n2));
    }
}(window.maths = window.maths || {}, jQuery));