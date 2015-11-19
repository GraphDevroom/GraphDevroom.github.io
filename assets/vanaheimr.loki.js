/*
 * Vanaheimr.Loki.js
 * Copyright (c) 2010-2014 Achim 'ahzf' Friedland <achim@graphdefined.org>
 * Based on: SpringyUI v2.0.1
 */

/**
Copyright (c) 2010 Dennis Hotson

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

(function() {

jQuery.fn.springy = function(params) {

    var graph = this.graph = params.graph || new Springy.Graph();

    //var nodeFont     = "16px Verdana, sans-serif"; //ahzf: default, if no label is given
    //var edgeFont     = "8px Verdana, sans-serif";
    var stiffness    = params.stiffness    || 400.0;
    var repulsion    = params.repulsion    || 400.0;
    var damping      = params.damping      || 0.5;
    var nodeSelected = params.nodeSelected || null;

    var canvas       = this[0];
    var ctx          = canvas.getContext("2d");

    var layout       = this.layout = new Springy.Layout.ForceDirected(graph, stiffness, repulsion, damping);

    // calculate bounding box of graph layout.. with ease-in
    var currentBB    = layout.getBoundingBox();
    var targetBB     = {
        bottomleft: new Springy.Vector(-2, -2),
        topright:   new Springy.Vector( 2,  2)
    };

    // auto adjusting bounding box
    Springy.requestAnimationFrame(function adjust() {

        targetBB = layout.getBoundingBox();

        // current gets 20% closer to target every iteration
        currentBB = {
            bottomleft: currentBB.bottomleft.
                                  add(targetBB.bottomleft.subtract(currentBB.bottomleft).
                                  divide(10)),
            topright:   currentBB.topright.
                                  add(targetBB.topright.subtract(currentBB.topright).
                                  divide(10))
        };

        Springy.requestAnimationFrame(adjust);

    });

    // convert to/from screen coordinates
    var toScreen = function(p) {
        var size = currentBB.topright.subtract(currentBB.bottomleft);
        var sx   = p.subtract(currentBB.bottomleft).divide(size.x).x * canvas.width;
        var sy   = p.subtract(currentBB.bottomleft).divide(size.y).y * canvas.height;
        return new Springy.Vector(sx, sy);
    };

    var fromScreen = function(s) {
        var size = currentBB.topright.subtract(currentBB.bottomleft);
        var px   = (s.x / canvas.width) * size.x + currentBB.bottomleft.x;
        var py   = (s.y / canvas.height) * size.y + currentBB.bottomleft.y;
        return new Springy.Vector(px, py);
    };

    // half-assed drag and drop
    var selected = null;
    var nearest  = null;
    var dragged  = null;

    var recursiveClick = function (element) {
        if (element.click !== undefined)
            element.click();
        else recursiveClick(element.parentNode);
    }

    jQuery(canvas).mousedown(function (e) {

        var pos    = jQuery(this).offset();

        var data   = canvas.getContext('2d').getImageData(e.pageX - pos.left, e.pageY - pos.top, 1, 1).data;
        var result = data[0] + data[1] + data[2] + data[3];
        if (result == 0)
        {

            // Hide the graph layer for a moment and check which
            // element on which layer might be clicked
            canvas.parentNode.hidden = true;

            var LayerBelow = document.elementFromPoint(e.clientX, e.clientY);
            if (LayerBelow !== null && LayerBelow.id != "graphbackground") {

                dragged = null;
                nearest = null;

                recursiveClick(LayerBelow);

            }

            canvas.parentNode.hidden = false;


            //if (LayerBelow.id == "graphbackground") {

            //    var p = fromScreen({ x: e.pageX - pos.left, y: e.pageY - pos.top });
            //    selected = nearest = dragged = layout.nearest(p);

            //    if (selected.node !== null) {

            //        dragged.point.m = 10000.0;

            //        if (nodeSelected) {
            //            nodeSelected(selected.node);
            //            if (selected.node.data.gotoURI !== undefined)
            //                dragged = null;
            //        }

            //    }

            //}

        }

        else
        {

            var p = fromScreen({ x: e.pageX - pos.left, y: e.pageY - pos.top });
            selected = nearest = dragged = layout.nearest(p);

            if (selected.node !== null) {

                dragged.point.m = 10000.0;

                if (nodeSelected) {
                    nodeSelected(selected.node);
                    if (selected.node.data.gotoURI !== undefined)
                        dragged = null;
                }

            }

        }





        var x = e.pageX - pos.left;
        var y = e.pageY - pos.top;
        //var boxWidth  = nearest.node.getWidth();
        //var boxHeight = nearest.node.getHeight();


        //ctx.clearRect(e.pageX - pos.left - boxWidth  / 2,
        //              e.pageY - pos.top  - boxHeight / 2,
        //              boxWidth,
        //              boxHeight);

        renderer.start();

    });

    // Basic double click handler
    jQuery(canvas).dblclick(function (e) {

        var pos  = jQuery(this).offset();
        var p    = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
        selected = layout.nearest(p);
        node     = selected.node;

        if (node && node.data && node.data.ondoubleclick) {
            node.data.ondoubleclick();
        }

    });

    jQuery(canvas).mousemove(function (e) {

        var pos = jQuery(this).offset();
        var p   = fromScreen({ x: e.pageX - pos.left, y: e.pageY - pos.top });
        nearest = layout.nearest(p);

        // Drag/move around a selected vertex
        if (dragged !== null && dragged.node !== null) {
            dragged.point.p.x = p.x;
            dragged.point.p.y = p.y;
        }

        renderer.start();

    });

    jQuery(window).bind('mouseup', function(e) {
        dragged = null;
    });

    Springy.Vertex.prototype.getWidth = function () {

        var text = (this.data.label !== undefined) ? this.data.label : this.id;

        if (this._width && this._width[text])
            return this._width[text];

        ctx.save();
        ctx.font = (this.data !== undefined) ? this.data.font(this.VertexLabel) : "10pt Verdana, sans-serif";
        var width = ctx.measureText(text).width + 10;
        ctx.restore();

        this._width || (this._width = {});
        this._width[text] = width;

        return width;

    };

    Springy.Vertex.prototype.getHeight = function () {

        if (this.VertexLabel == "text")
            return 20;
        else if (this.VertexLabel == "tag")
            return 16;
        else if (this.VertexLabel == "info")
            return 16;
        else
            return 20;

    };

    var roundRect = function roundRect(context, x, y, w, h, r, fillstyle, lineWidth, strokestyle) {

        context.beginPath();

        context.moveTo(x + r, y);
        context.lineTo(x + w - r, y);
        context.quadraticCurveTo(x + w, y, x + w, y + r);
        context.lineTo(x + w, y + h - r);
        context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        context.lineTo(x + r, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);

        context.fillStyle = fillstyle;

        context.shadowBlur      = 3;
        context.shadowColor     = '#555555';
        context.shadowOffsetX   = 2;
        context.shadowOffsetY   = 2;

        context.fill();

        context.shadowBlur      = 0;
        context.shadowColor     = '#555555';
        context.shadowOffsetX   = 0;
        context.shadowOffsetY   = 0;

        if (lineWidth > 0) {
            context.strokeStyle = strokestyle;
            context.lineWidth   = lineWidth;
            context.stroke();
        }

        context.closePath();

    };

    var DrawEllipse = function DrawEllipse(context, x, y, w, h, fillstyle, lineWidth, strokestyle) {

        context.save();

        context.beginPath();

        // translate context
        //  context.translate(canvas.width / 2, canvas.height / 2);

        // scale context horizontally
        context.scale(1, h/w);

        // draw circle which will be stretched into an oval
        context.arc(          x,
                    (w/h) *   y,
                            w/2,
                    0, 2 * Math.PI);

        // restore to original state
        context.restore();

        context.fillStyle      = fillstyle;

        context.shadowBlur     = 3;
        context.shadowColor    = '#555555';
        context.shadowOffsetX  = 2;
        context.shadowOffsetY  = 2;

        context.fill();

        context.shadowBlur     = 0;
        context.shadowColor    = '#555555';
        context.shadowOffsetX  = 0;
        context.shadowOffsetY  = 0;

        if (lineWidth > 0) {
            context.strokeStyle  = strokestyle;
            context.lineWidth    = lineWidth;
            context.stroke();
        }

        context.closePath();

    };

    this.clear = function(){
        graph.nodeSet    = {};
        graph.nodes      = [];
        graph.edges      = [];
        graph.adjacency  = {};
        graph.notify();
    }

    var renderer = this.renderer = new Springy.Renderer(layout,

        function clear() {

            ctx.clearRect(0,
                          0,
                          canvas.width,
                          canvas.height);

        },

        function drawEdge(edge, p1, p2) {

            var x1        = toScreen(p1).x;
            var y1        = toScreen(p1).y;
            var x2        = toScreen(p2).x;
            var y2        = toScreen(p2).y;

            var direction = new Springy.Vector(x2-x1, y2-y1);
            var normal    = direction.normal().normalise();

            var from      = graph.getEdges(edge.source, edge.target);
            var to        = graph.getEdges(edge.target, edge.source);

            var total     = from.length + to.length;

            // Figure out edge's position in relation to other edges between the same nodes
            var n = 0;
            for (var i=0; i<from.length; i++) {
                if (from[i].id === edge.id) {
                    n = i;
                }
            }

            var spacing = 10.0;

            // Figure out how far off center the line should be drawn
            var offset = normal.multiply(-((total - 1) * spacing)/2.0 + (n * spacing));

            var s1 = toScreen(p1).add(offset);
            var s2 = toScreen(p2).add(offset);

            var boxWidth  = edge.target.getWidth ();
            var boxHeight = edge.target.getHeight();

            var intersection = intersect_line_box(s1, s2, { x: x2-boxWidth/2.0, y: y2-boxHeight/2.0 }, boxWidth, boxHeight);
            if (!intersection)
                intersection = s2;

            var stroke       = (edge.data.color       !== undefined) ? edge.data.color       : '#000000';
            var weight       = (edge.data.weight      !== undefined) ? edge.data.weight      : 1.0;
            ctx.lineWidth    = Math.max(weight *  2, 0.1);
            var arrowWidth   = 1 + ctx.lineWidth;
            var arrowLength  = 8;
            var directional  = (edge.data.directional !== undefined) ? edge.data.directional : true;
            var lineEnd      = (!directional)                        ? s2                    : intersection.subtract(direction.normalise().multiply(arrowLength * 0.5));

            ctx.strokeStyle = stroke;
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(lineEnd.x, lineEnd.y);
            ctx.stroke();

            // arrow
            if (directional) {
                ctx.save();
                ctx.fillStyle = stroke;
                ctx.translate(intersection.x, intersection.y);
                ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
                ctx.beginPath();
                ctx.moveTo(-arrowLength, arrowWidth);
                ctx.lineTo(0, 0);
                ctx.lineTo(-arrowLength, -arrowWidth);
                ctx.lineTo(-arrowLength * 0.8, -0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // label
            if (edge.data.label !== undefined) {
                text = edge.data.label
                ctx.save();
                ctx.textAlign    = "center";
                ctx.textBaseline = "middle";
                ctx.font         = edge.data.font;
                ctx.fillStyle    = (edge.data.labelcolor !== undefined) ? edge.data.labelcolor : stroke;
                var textPos      = (s2.x < s1.x) ? s1.add(s2).divide(2).add(normal.multiply(-8))
                                                 : s1.add(s2).divide(2).add(normal.multiply(8));
                ctx.translate(textPos.x, textPos.y);
                ctx.rotate((s2.x < s1.x) ? Math.atan2(s1.y - s2.y, s1.x - s2.x)
                                         : Math.atan2(s2.y - s1.y, s2.x - s1.x));
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }

        },

        function drawNode(node, p) {

            var s = toScreen(p);

            ctx.save();

            var boxWidth  = node.getWidth();
            var boxHeight = node.getHeight();

            // clear background
            //ctx.clearRect(s.x - boxWidth  / 2,
            //              s.y - boxHeight / 2,
            //              boxWidth,
            //              boxHeight);


            // lineWidth/strokeColor
            var additionalWidth     = 0;
            var fillStyle           = "#000000";
            var strokeThickness     = 0;
            var strokeColor         = "#000000";
            var cornerRadius        = 8;
            var yOffset             = 0;

            if (node.VertexLabel == "text") {
                additionalWidth     = 8;
                fillStyle           = "rgba(243, 243, 243, 0.9)";
                cornerRadius        = 12;
                strokeThickness     = 1;
                strokeColor         = "rgba(112,  82, 112, 0.65)";
            }
            else if (node.VertexLabel == "tag") {
                fillStyle           = fillStyle = "rgba(156, 70, 177, 0.9)";
                strokeThickness     = 0;
                cornerRadius        = 6;
                yOffset             = 2;
            }
            else if (node.VertexLabel == "info") {
                fillStyle           = fillStyle = "#FAD961";
                strokeThickness     = 0;
                cornerRadius        = 6;
                yOffset             = 2;
            }
            else if (node.VertexLabel == "history") {
                fillStyle           = fillStyle = "rgba(200, 200, 0, 0.8)";
                strokeThickness     = 0;
                cornerRadius        = 6;
                yOffset             = 2;
            }

            if (nearest !== null && nearest.node !== null && nearest.node.id === node.id) {
                fillStyle           = "#FFFFEE";
                strokeThickness     = 3;
            }

            if (node.VertexLabel == "text")
                DrawEllipse(ctx,
                            s.x, s.y,
                            1.2 * boxWidth,
                            2.0 * boxHeight,
                            fillStyle,
                            strokeThickness,
                            strokeColor);

            else if (node.VertexLabel == "history")
                DrawEllipse(ctx,
                            s.x, s.y,
                            1.0 * boxWidth,
                            1.0 * boxWidth,
                            fillStyle,
                            strokeThickness,
                            strokeColor);

            else
                roundRect(ctx,
                          s.x - boxWidth  / 2 - additionalWidth / 2,
                          s.y - boxHeight / 2 - yOffset,
                          boxWidth + additionalWidth,
                          boxHeight,
                          cornerRadius,
                          fillStyle,
                          strokeThickness,
                          strokeColor);

            ctx.textAlign    = "left";
            ctx.textBaseline = "middle";

            // Text color
            if (node.VertexLabel == "text")
                ctx.fillStyle = "rgba(156, 70, 177, 0.8)";
            else if (node.VertexLabel == "tag")
                ctx.fillStyle = "#F0F0F0";
            else if (node.VertexLabel == "info")
                ctx.fillStyle = "#000000";
            else if (node.VertexLabel == "history")
                ctx.fillStyle = "rgba(100, 100, 0, 0.8)";
            else
                ctx.fillStyle = "#000000";

            if (nearest !== null && nearest.node !== null && nearest.node.id === node.id) {
                ctx.fillStyle       = "#000000";
            }

            ctx.font         = node.data.font(node.VertexLabel);

            var text = (node.data.label !== undefined) ? node.data.label : node.id;

            ctx.fillText(text,
                         s.x - boxWidth / 2 + 5,
                         s.y - 1);

            ctx.restore();

        }

    );

    renderer.start();


    // helpers for figuring out where to draw arrows
    function intersect_line_line(p1, p2, p3, p4) {

        var denom = ((p4.y - p3.y)*(p2.x - p1.x) - (p4.x - p3.x)*(p2.y - p1.y));

        // lines are parallel
        if (denom === 0) {
            return false;
        }

        var ua = ((p4.x - p3.x)*(p1.y - p3.y) - (p4.y - p3.y)*(p1.x - p3.x)) / denom;
        var ub = ((p2.x - p1.x)*(p1.y - p3.y) - (p2.y - p1.y)*(p1.x - p3.x)) / denom;

        if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
            return false;
        }

        return new Springy.Vector(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));

    }

    function intersect_line_box(p1, p2, p3, w, h) {

        var tl = {x: p3.x,     y: p3.y};
        var tr = {x: p3.x + w, y: p3.y};
        var bl = {x: p3.x,     y: p3.y + h};
        var br = {x: p3.x + w, y: p3.y + h};

        var result;
        if (result = intersect_line_line(p1, p2, tl, tr)) { return result; } // top
        if (result = intersect_line_line(p1, p2, tr, br)) { return result; } // right
        if (result = intersect_line_line(p1, p2, br, bl)) { return result; } // bottom
        if (result = intersect_line_line(p1, p2, bl, tl)) { return result; } // left

        return false;

    }

    return this;

}

})();
