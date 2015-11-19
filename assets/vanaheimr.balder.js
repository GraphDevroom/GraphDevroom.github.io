/*
 * Vanaheimr.Balder.js
 * Copyright (c) 2010-2014 Achim 'ahzf' Friedland <achim@graphdefined.org>
 * Based on: Springy v2.0.1
 */

/**
 * Springy v2.0.1
 *
 * Copyright (c) 2010 Dennis Hotson
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

(function () {

    // Enable strict mode for EC5 compatible browsers
    "use strict";

    // Establish the root object, `window` in the browser, or `global` on the server.
    var root     = this;

    // The top-level namespace. All public Springy classes and modules will
    // be attached to this. Exported for both CommonJS and the browser.
    var Springy  = (typeof exports !== 'undefined')
                       ? Springy = exports
                       : root.Springy = {};


    // Graph management --------------------------------------------------------

    var Graph    = Springy.Graph = function () {

        this.eventListeners   = [];

        // Vertices
        this.Vertices         = [];
        this.nextVertexId     = 0;
        this.VertexSet        = {};

        // Edges
        this.edges            = [];
        this.nextEdgeId       = 0;
        this.adjacency        = {};

        // MultiEdges
        this.MultiEdges       = [];
        this.nextMultiEdgeId  = 0;

        // HyperEdges
        this.HyperEdges       = [];
        this.nextHyperEdgeId  = 0;

    };

    // Add vertices and edges from a JSON object
    Graph.prototype.loadJSON = function (json) {
        /**
        Springy's simple JSON format for graphs.
        historically, Springy uses separate lists
        of vertices and edges:

            {
                "vertices": [
                    "center",
                    "left",
                    "right",
                    "up",
                    "satellite"
                ],
                "edges": [
                    ["center", "left"],
                    ["center", "right"],
                    ["center", "up"]
                ]
            }

        **/
        // parse if a string is passed (EC5+ browsers)
        if (typeof json == 'string' || json instanceof String) {
            json = JSON.parse(json);
        }

        if ('vertices' in json || 'edges' in json) {
            this.addVertices.apply(this, json['vertices']);
            this.addEdges.apply(this, json['edges']);
        }
    }

    /* Merge a list of vertices and edges into the current graph. eg.
    var o = {
        vertices: [
            { id: 123, data: { type: 'user', userid: 123, displayname: 'aaa' } },
            { id: 234, data: { type: 'user', userid: 234, displayname: 'bbb' } }
        ],
        edges: [
            { from: 0, to: 1, type: 'submitted_design', directed: true, data: { weight: }}
        ]
    }
    */
    Graph.prototype.merge = function (data) {

        var Vertices = [];

        data.Vertices.forEach(function (n) {
            Vertices.push(this.addVertex(new Vertex(n.id, n.data)));
        }, this);

        data.edges.forEach(function (e) {

            var from = Vertices[e.from];
            var to = Vertices[e.to];

            var id = (e.directed) ? (id = e.type + "-" + from.id + "-" + to.id)
                                     : (from.id < to.id) // normalise id for non-directed edges
                                           ? e.type + "-" + from.id + "-" + to.id
                                           : e.type + "-" + to.id + "-" + from.id;

            var edge = this.addEdge(new Edge(id, from, e.label, to, e.data));
            edge.data.type = e.type;// label?

        }, this);

    };

    Graph.prototype.addGraphListener = function (obj) {
        this.eventListeners.push(obj);
    };

    Graph.prototype.notify = function () {
        this.eventListeners.forEach(function (obj) {
            obj.graphChanged();
        });
    };



    // Vertex management -------------------------------------------------------

    var Vertex = Springy.Vertex = function (id, label, data) {

        this.id             = id;
        this.VertexLabel    = label;
        this.data           = (data !== undefined) ? data : {};

        this.data.font      = function (VL) {

            if (VL == "talk")
                return "10pt Verdana, sans-serif";
            else if (VL == "tag")
                return "7pt Verdana, sans-serif";
            else if (VL == "info")
                return "7pt Verdana, sans-serif";
            else if (VL == "history")
                return "7pt Verdana, sans-serif";
            else
                return "10pt Verdana, sans-serif";

        }


        // Data fields used by layout algorithm in this file:
        //   this.data.mass

        // Data used by default renderer in springyui.js
        //   this.data.label

    };

    Graph.prototype.addVertex = function (vertex) {

        if (!(vertex.id in this.VertexSet)) {
            this.Vertices.push(vertex);
        }

        this.VertexSet[vertex.id] = vertex;

        this.notify();

        return vertex;

    };

    Graph.prototype.addVertices = function () {

        // accepts variable number of arguments, where each argument
        // is a string that becomes both node identifier and label
        for (var i = 0; i < arguments.length; i++) {
            var name = arguments[i];
            this.addVertex(new Vertex(name, { label: name }));
        }

    };

    Graph.prototype.newVertex = function (label, data) {
        return this.addVertex(new Vertex(this.nextVertexId++, label, data));
    };

    // Remove a vertex and it's associated edges
    Graph.prototype.removeVertex = function (vertex) {

        if (vertex.id in this.VertexSet) {
            delete this.VertexSet[vertex.id];
        }

        for (var i = this.Vertices.length - 1; i >= 0; i--) {
            if (this.Vertices[i].id === vertex.id) {
                this.Vertices.splice(i, 1);
            }
        }

        this.detachVertex(vertex);

    };

    // Remove all edges associated with the given vertex
    Graph.prototype.detachVertex = function (vertex) {

        var tmpEdges = this.edges.slice();

        tmpEdges.forEach(function (e) {

            if (e.source.id === vertex.id ||
                e.target.id === vertex.id)
                this.removeEdge(e);

        }, this);

        this.notify();

    };

    Graph.prototype.filterVertices = function (fn) {

        var tmpNodes = this.Vertices.slice();

        tmpNodes.forEach(function (n) {
            if (!fn(n)) {
                this.removeVertex(n);
            }
        }, this);

    };



    // Edge management ---------------------------------------------------------

    var Edge = Springy.Edge = function (id, source, EdgeLabel, target, data) {

        this.id             = id;
        this.source         = source;
        this.EdgeLabel      = EdgeLabel;
        this.target         = target;
        this.data           = (data !== undefined) ? data : {};

        this.data.font      = "7pt Verdana, sans-serif";

        // Edge data field used by layout alorithm
        //   this.data.length
        //   this.data.type

        if (EdgeLabel == "next")
        {
            this.data.label         = (this.data.label          !== undefined) ? this.data.label        : 'next';
            this.data.color         = (this.data.color          !== undefined) ? this.data.color        : 'rgba(110, 41, 127, 0.87)';
            this.data.directional   = (this.data.directional    !== undefined) ? this.data.directional  : true;
            this.data.weight        = (this.data.weight         !== undefined) ? this.data.weight       : 1;
        }

        else if (EdgeLabel == "goto")
        {
            this.data.label         = (this.data.label          !== undefined) ? this.data.label        : 'goto';
            this.data.color         = (this.data.color          !== undefined) ? this.data.color        : 'rgba(110, 41, 127, 0.37)';
            this.data.directional   = (this.data.directional    !== undefined) ? this.data.directional  : true;
            this.data.weight        = (this.data.weight         !== undefined) ? this.data.weight       : 1;
        }

        else if (EdgeLabel == "lookback") {
            this.data.label         = (this.data.label          !== undefined) ? this.data.label        : 'look back';
            this.data.color         = (this.data.color          !== undefined) ? this.data.color        : 'rgba(100, 100, 0, 0.8)';
            this.data.directional   = (this.data.directional    !== undefined) ? this.data.directional  : true;
            this.data.weight        = (this.data.weight         !== undefined) ? this.data.weight       : 1;
        }

    };

    Graph.prototype.addEdge = function (edge) {

        var exists = false;

        this.edges.forEach(function(e) {
            if (edge.id === e.id) { exists = true; }
        });

        if (!exists) {
            this.edges.push(edge);
        }

        if (!(edge.source.id in this.adjacency)) {
            this.adjacency[edge.source.id] = {};
        }
        if (!(edge.target.id in this.adjacency[edge.source.id])) {
            this.adjacency[edge.source.id][edge.target.id] = [];
        }

        exists = false;
        this.adjacency[edge.source.id][edge.target.id].forEach(function(e) {
                if (edge.id === e.id) { exists = true; }
        });

        if (!exists) {
            this.adjacency[edge.source.id][edge.target.id].push(edge);
        }

        this.notify();

        return edge;

    };

    Graph.prototype.addEdges = function () {

        // accepts variable number of arguments, where each argument
        // is a triple [nodeid1, nodeid2, attributes]
        for (var i = 0; i < arguments.length; i++) {

            var edgeDefinition = arguments[i];

            var vertex1 = this.VertexSet[edgeDefinition[0]];
            if (vertex1 == undefined)
                throw new TypeError("invalid vertex: " + edgeDefinition[0]);

            var vertex2 = this.VertexSet[edgeDefinition[1]];
            if (vertex2 == undefined)
                throw new TypeError("invalid vertex: " + edgeDefinition[1]);

            this.newEdge(vertex1, vertex2, edgeDefinition[2]);

        }

    };

    Graph.prototype.newEdge = function (source, label, target, data) {
        return this.addEdge(new Edge(this.nextEdgeId++, source, label, target, data));
    };

    // find all edges from vertex1 to vertex2
    Graph.prototype.getEdges = function (vertex1, vertex2) {

        if (vertex1.id in this.adjacency &&
            vertex2.id in this.adjacency[vertex1.id])
            return this.adjacency[vertex1.id][vertex2.id];

        return [];

    };

    // remove an edge from the graph
    Graph.prototype.removeEdge = function (edge) {

        for (var i = this.edges.length - 1; i >= 0; i--) {
            if (this.edges[i].id === edge.id) {
                this.edges.splice(i, 1);
            }
        }

        for (var x in this.adjacency) {

            for (var y in this.adjacency[x]) {

                var edges = this.adjacency[x][y];

                for (var j = edges.length - 1; j >= 0; j--) {
                    if (this.adjacency[x][y][j].id === edge.id) {
                        this.adjacency[x][y].splice(j, 1);
                    }
                }

                // Clean up empty edge arrays
                if (this.adjacency[x][y].length == 0) {
                    delete this.adjacency[x][y];
                }

            }

            // Clean up empty objects
            if (isEmpty(this.adjacency[x])) {
                delete this.adjacency[x];
            }

        }

        this.notify();

    };

    Graph.prototype.filterEdges = function (fn) {

        var tmpEdges = this.edges.slice();

        tmpEdges.forEach(function (e) {
            if (!fn(e)) {
                this.removeEdge(e);
            }
        }, this);

    };




    // -----------



    var Layout = Springy.Layout = {};

    Layout.ForceDirected = function(graph, stiffness, repulsion, damping) {
        this.graph = graph;
        this.stiffness = stiffness; // spring stiffness constant
        this.repulsion = repulsion; // repulsion constant
        this.damping = damping; // velocity damping factor

        this.nodePoints = {}; // keep track of points associated with nodes
        this.edgeSprings = {}; // keep track of springs associated with edges
    };

    Layout.ForceDirected.prototype.point = function(node) {
        if (!(node.id in this.nodePoints)) {
            var mass = (node.data.mass !== undefined) ? node.data.mass : 1.0;
            this.nodePoints[node.id] = new Layout.ForceDirected.Point(Vector.random(), mass);
        }

        return this.nodePoints[node.id];
    };

    Layout.ForceDirected.prototype.spring = function(edge) {
        if (!(edge.id in this.edgeSprings)) {
            var length = (edge.data.length !== undefined) ? edge.data.length : 1.0;

            var existingSpring = false;

            var from = this.graph.getEdges(edge.source, edge.target);
            from.forEach(function(e) {
                if (existingSpring === false && e.id in this.edgeSprings) {
                    existingSpring = this.edgeSprings[e.id];
                }
            }, this);

            if (existingSpring !== false) {
                return new Layout.ForceDirected.Spring(existingSpring.point1, existingSpring.point2, 0.0, 0.0);
            }

            var to = this.graph.getEdges(edge.target, edge.source);
            from.forEach(function(e){
                if (existingSpring === false && e.id in this.edgeSprings) {
                    existingSpring = this.edgeSprings[e.id];
                }
            }, this);

            if (existingSpring !== false) {
                return new Layout.ForceDirected.Spring(existingSpring.point2, existingSpring.point1, 0.0, 0.0);
            }

            this.edgeSprings[edge.id] = new Layout.ForceDirected.Spring(
                this.point(edge.source), this.point(edge.target), length, this.stiffness
            );
        }

        return this.edgeSprings[edge.id];
    };

    // callback should accept two arguments: Node, Point
    Layout.ForceDirected.prototype.eachNode = function(callback) {
        var t = this;
        this.graph.Vertices.forEach(function(n){
            callback.call(t, n, t.point(n));
        });
    };

    // callback should accept two arguments: Edge, Spring
    Layout.ForceDirected.prototype.eachEdge = function(callback) {
        var t = this;
        this.graph.edges.forEach(function(e){
            callback.call(t, e, t.spring(e));
        });
    };

    // callback should accept one argument: Spring
    Layout.ForceDirected.prototype.eachSpring = function(callback) {
        var t = this;
        this.graph.edges.forEach(function(e){
            callback.call(t, t.spring(e));
        });
    };


    // Physics stuff
    Layout.ForceDirected.prototype.applyCoulombsLaw = function() {
        this.eachNode(function(n1, point1) {
            this.eachNode(function(n2, point2) {
                if (point1 !== point2)
                {
                    var d = point1.p.subtract(point2.p);
                    var distance = d.magnitude() + 0.1; // avoid massive forces at small distances (and divide by zero)
                    var direction = d.normalise();

                    // apply force to each end point
                    point1.applyForce(direction.multiply(this.repulsion).divide(distance * distance * 0.5));
                    point2.applyForce(direction.multiply(this.repulsion).divide(distance * distance * -0.5));
                }
            });
        });
    };

    Layout.ForceDirected.prototype.applyHookesLaw = function() {
        this.eachSpring(function(spring){
            var d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
            var displacement = spring.length - d.magnitude();
            var direction = d.normalise();

            // apply force to each end point
            spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
            spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
        });
    };

    Layout.ForceDirected.prototype.attractToCentre = function() {
        this.eachNode(function(node, point) {
            var direction = point.p.multiply(-1.0);
            point.applyForce(direction.multiply(this.repulsion / 50.0));
        });
    };


    Layout.ForceDirected.prototype.updateVelocity = function(timestep) {
        this.eachNode(function(node, point) {
            // Is this, along with updatePosition below, the only places that your
            // integration code exist?
            point.v = point.v.add(point.a.multiply(timestep)).multiply(this.damping);
            point.a = new Vector(0,0);
        });
    };

    Layout.ForceDirected.prototype.updatePosition = function(timestep) {
        this.eachNode(function(node, point) {
            // Same question as above; along with updateVelocity, is this all of
            // your integration code?
            point.p = point.p.add(point.v.multiply(timestep));
        });
    };

    // Calculate the total kinetic energy of the system
    Layout.ForceDirected.prototype.totalEnergy = function(timestep) {
        var energy = 0.0;
        this.eachNode(function(node, point) {
            var speed = point.v.magnitude();
            energy += 0.5 * point.m * speed * speed;
        });

        return energy;
    };

    var __bind = function (fn, me) {
        return function () {
            return fn.apply(me, arguments);
        };
    }; // stolen from coffeescript, thanks jashkenas! ;-)

    Springy.requestAnimationFrame = __bind(root.requestAnimationFrame       ||
                                           root.webkitRequestAnimationFrame ||
                                           root.mozRequestAnimationFrame    ||
                                           root.oRequestAnimationFrame      ||
                                           root.msRequestAnimationFrame     ||
                                           (function(callback, element) {
                                               root.setTimeout(callback, 10);
                                           }), root);


    // start simulation
    Layout.ForceDirected.prototype.start = function (render, onRenderStop, onRenderStart) {

        var t          = this;

        if (this._started) return;

        this._started  = true;
        this._stop     = false;

        if (onRenderStart !== undefined) { onRenderStart(); }

        Springy.requestAnimationFrame(function step() {
            t.applyCoulombsLaw();
            t.applyHookesLaw();
            t.attractToCentre();
            t.updateVelocity(0.03);
            t.updatePosition(0.03);

            if (render !== undefined) {
                render();
            }

            // stop simulation when energy of the system goes below a threshold
            if (t._stop || t.totalEnergy() < 0.01) {
                t._started = false;
                if (onRenderStop !== undefined) { onRenderStop(); }
            } else {
                Springy.requestAnimationFrame(step);
            }
        });
    };

    Layout.ForceDirected.prototype.stop = function() {
        this._stop = true;
    }

    // Find the nearest point to a particular position
    Layout.ForceDirected.prototype.nearest = function (pos) {

        var min = { node: null, point: null, distance: null };
        var t   = this;

        this.graph.Vertices.forEach(function(n) {
            var point    = t.point(n);
            var distance = point.p.subtract(pos).magnitude();

            if (min.distance === null || distance < min.distance) {
                min = { node: n, point: point, distance: distance };
            }
        });

        return min;

    };

    // returns [bottomleft, topright]
    Layout.ForceDirected.prototype.getBoundingBox = function () {

        var bottomleft = new Vector(-2,-2);
        var topright   = new Vector( 2, 2);

        this.eachNode(function (n, point) {

            if (point.p.x < bottomleft.x) {
                bottomleft.x = point.p.x;
            }

            if (point.p.y < bottomleft.y) {
                bottomleft.y = point.p.y;
            }

            if (point.p.x > topright.x) {
                topright.x = point.p.x;
            }

            if (point.p.y > topright.y) {
                topright.y = point.p.y;
            }

        });

        var padding = topright.subtract(bottomleft).multiply(0.07); // ~5% padding

        return { bottomleft: bottomleft.subtract(padding), topright: topright.add(padding) };

    };



    // Vector
    var Vector = Springy.Vector = function(x, y) {
        this.x = x;
        this.y = y;
    };

    Vector.random = function() {
        return new Vector(10.0 * (Math.random() - 0.5), 10.0 * (Math.random() - 0.5));
    };

    Vector.prototype.add = function(v2) {
        return new Vector(this.x + v2.x, this.y + v2.y);
    };

    Vector.prototype.subtract = function(v2) {
        return new Vector(this.x - v2.x, this.y - v2.y);
    };

    Vector.prototype.multiply = function(n) {
        return new Vector(this.x * n, this.y * n);
    };

    Vector.prototype.divide = function(n) {
        return new Vector((this.x / n) || 0, (this.y / n) || 0); // Avoid divide by zero errors..
    };

    Vector.prototype.magnitude = function() {
        return Math.sqrt(this.x*this.x + this.y*this.y);
    };

    Vector.prototype.normal = function() {
        return new Vector(-this.y, this.x);
    };

    Vector.prototype.normalise = function() {
        return this.divide(this.magnitude());
    };



    // Point
    Layout.ForceDirected.Point = function(position, mass) {
        this.p = position; // position
        this.m = mass; // mass
        this.v = new Vector(0, 0); // velocity
        this.a = new Vector(0, 0); // acceleration
    };

    Layout.ForceDirected.Point.prototype.applyForce = function(force) {
        this.a = this.a.add(force.divide(this.m));
    };

    // Spring
    Layout.ForceDirected.Spring = function(point1, point2, length, k) {
        this.point1 = point1;
        this.point2 = point2;
        this.length = length; // spring length at rest
        this.k = k; // spring constant (See Hooke's law) .. how stiff the spring is
    };

    // Layout.ForceDirected.Spring.prototype.distanceToPoint = function(point)
    // {
    //     // hardcore vector arithmetic.. ohh yeah!
    //     // .. see http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment/865080#865080
    //     var n = this.point2.p.subtract(this.point1.p).normalise().normal();
    //     var ac = point.p.subtract(this.point1.p);
    //     return Math.abs(ac.x * n.x + ac.y * n.y);
    // };

    /*
     * Renderer handles the layout rendering loop
     * @param onRenderStop optional callback function that gets executed whenever rendering stops.
     * @param onRenderStart optional callback function that gets executed whenever rendering starts.
     */
    var Renderer = Springy.Renderer = function(layout, clear, drawEdge, drawNode, onRenderStop, onRenderStart) {

        this.layout         = layout;
        this.clear          = clear;
        this.drawEdge       = drawEdge;
        this.drawNode       = drawNode;
        this.onRenderStop   = onRenderStop;
        this.onRenderStart  = onRenderStart;

        this.layout.graph.addGraphListener(this);

    }

    Renderer.prototype.graphChanged = function(e) {
        this.start();
    };

    /*
     * @param done An optional callback function that gets executed when the springy algorithm stops, 
     *             either because it ended or because stop() was called.
     */
    Renderer.prototype.start = function(done) {
        var t = this;
        this.layout.start(function render() {
            t.clear();

            t.layout.eachEdge(function(edge, spring) {
                t.drawEdge(edge, spring.point1.p, spring.point2.p);
            });

            t.layout.eachNode(function(node, point) {
                t.drawNode(node, point.p);
            });
        }, this.onRenderStop, this.onRenderStart);
    };

    Renderer.prototype.stop = function() {
        this.layout.stop();
    };

    // Array.forEach implementation for IE support..
    //https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach
    if ( !Array.prototype.forEach ) {
        Array.prototype.forEach = function( callback, thisArg ) {
            var T, k;
            if ( this == null ) {
                throw new TypeError( " this is null or not defined" );
            }
            var O = Object(this);
            var len = O.length >>> 0; // Hack to convert O.length to a UInt32
            if ( {}.toString.call(callback) != "[object Function]" ) {
                throw new TypeError( callback + " is not a function" );
            }
            if ( thisArg ) {
                T = thisArg;
            }
            k = 0;
            while( k < len ) {
                var kValue;
                if ( k in O ) {
                    kValue = O[ k ];
                    callback.call( T, kValue, k, O );
                }
                k++;
            }
        };
    }

    var isEmpty = function(obj) {
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                return false;
            }
        }
        return true;
    };

}).call(this);
