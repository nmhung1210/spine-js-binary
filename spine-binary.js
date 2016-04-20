/******************************************************************************
 * Spine JS Binary
 * Version 1.0
 * 
 * Copyright (c) 2016, nmhung1210
 * All rights reserved.
 * 
 * You are granted a perpetual, non-exclusive, non-sublicensable and
 * non-transferable license to use, install, execute and perform the Spine
 * Runtimes Software (the "Software") and derivative works solely for personal
 * or internal use. Without the written permission of Esoteric Software (see
 * Section 2 of the Spine Software License Agreement), you may not (a) modify,
 * translate, adapt or otherwise create derivative works, improvements of the
 * Software or develop new applications using the Software or (b) remove,
 * delete, alter or obscure any trademarks or any copyright, trademark, patent
 * or other intellectual property or proprietary rights notices on or in the
 * Software, including any copy thereof. Redistributions in binary or source
 * form must include this license and terms.
 * 
 * THIS SOFTWARE IS PROVIDED BY ESOTERIC SOFTWARE "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL ESOTERIC SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/


var ATTACHMENT_REGION = 0;
var ATTACHMENT_BOUNDING_BOX = 1;
var ATTACHMENT_MESH = 2;
var ATTACHMENT_WEIGHTED_MESH = 3;
var ATTACHMENT_LINKED_MESH = 4;
var ATTACHMENT_WEIGHTED_LINKED_MESH = 5;

var BLEND_MODE_NORMAL = 0;
var BLEND_MODE_ADDITIVE = 1;
var BLEND_MODE_MULTIPLY = 2;
var BLEND_MODE_SCREEN = 3;

var CURVE_LINEAR = 0;
var CURVE_STEPPED = 1;
var CURVE_BEZIER = 2;

var TIMELINE_SCALE = 0;
var TIMELINE_ROTATE = 1;
var TIMELINE_TRANSLATE = 2;
var TIMELINE_ATTACHMENT = 3;
var TIMELINE_COLOR = 4;
var TIMELINE_FLIPX = 5;
var TIMELINE_FLIPY = 6;

spine.BReader = function(buffer)
{
    this.buffer = new Uint8Array(buffer);
    this.position = 0;
};

spine.BReader.prototype = {
    readByte:function()
    {
        return this.buffer[this.position++];
    },
    readSByte:function()
    {
        var value = this.readByte();
        var bmax = Math.pow(2, 8);
        if (value >= bmax/2)
        {
            value = value - bmax;
        }
        return value;
    },
    readShort:function()
    {
        return (this.readByte() << 8) | this.readByte();
    },
    readShortArray:function()
    {
        var len = this.readVarint();
        var values = [];
        for(var i=0; i< len; i++)
        {
            values[i] = this.readShort();
        }
        return values;
    },
    readInt:function()
    {
       return (this.readByte() << 24) | (this.readByte() << 16) | (this.readByte() << 8) | this.readByte();
    },
    readIntArray:function()
    {
        var n = this.readVarint(true);
        var values = [];     
        for (var i = 0; i < n; i++)
        {
            values.push(this.readFloat());
        }
        return values;
    },
    readVarint:function(optimizePositive)
    {
        var b = this.readByte();
        var result = b & 0x7F;
        if ((b & 0x80) !== 0) {
            b = this.readByte();
            result |= (b & 0x7F) << 7;
            if ((b & 0x80) !== 0) {
                b = this.readByte();
                result |= (b & 0x7F) << 14;
                if ((b & 0x80) !== 0) {
                    b = this.readByte();
                    result |= (b & 0x7F) << 21;
                    if ((b & 0x80) !== 0) result |= (this.readByte() & 0x7F) << 28;
                }
            }
        }
        return optimizePositive ? result : ((result >> 1) ^ -(result & 1));
    },
    readFloat:function()
    {
        var arrbuffer = new ArrayBuffer(4);
        var uint8arr = new Uint8Array(arrbuffer);
        var f32arr = new Float32Array(arrbuffer);
        uint8arr[3] = this.readByte();
        uint8arr[2] = this.readByte();
        uint8arr[1] = this.readByte();
        uint8arr[0] = this.readByte();
        return f32arr[0];    
    },
    readFloatArray:function(scale) {
        var n = this.readVarint(true);
        var values = [];
        if(scale === 1)
        {
            for (var i = 0; i < n; i++)
            {
                values.push(this.readFloat());
            }
        }else{
            for (var i = 0; i < n; i++)
            {
                values.push(this.readFloat() * scale);
            }
        }
        return values;
    },
    readString:function()
    {
        var charCount = this.readVarint(true);
        switch (charCount) {
            case 0:
                return null;
            case 1:
                return "";
        }
        charCount--;
        var chars=[];
        // Try to read 7 bit ASCII chars.
        var b = 0;
        while (chars.length < charCount) {
            b = this.readByte();
            if (b > 127) break;
            chars.push(String.fromCharCode(b));
        }
        // If a char was not ASCII, finish with slow path.
        if (chars.length < charCount)
        {
            this.readUtf8_slow(chars, charCount, b);
        }
        return chars.join("");
    },
    readUtf8_slow:function(chars, charCount, b)
    {
        for (;;) {
            switch (b >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    chars.push(b);
                    break;
                case 12:
                case 13:
                    chars.push((((b & 0x1F) << 6) | (this.readByte() & 0x3F)));
                    break;
                case 14:
                    chars.push((((b & 0x0F) << 12) | ((this.readByte() & 0x3F) << 6) | (this.readByte() & 0x3F)));
                    break;
            }
            if (chars.length >= charCount) break;
            b = this.readByte() & 0xFF;
        }                
    },
    readColor:function()
    {
        var value = [];
        var rgba = this.readInt();
        value[0] = ((rgba & 0xff000000) >>> 24) / 255; // R
        value[1] = ((rgba & 0x00ff0000) >>> 16) / 255; // G
        value[2] = ((rgba & 0x0000ff00) >>> 8) / 255; // B
        value[3] = ((rgba & 0x000000ff)) / 255; // A
        return value;
    },
    readBoolean:function()
    {
        return this.readByte() !== 0;
    }
};

spine.TransformConstraintData = function(name)
{
    this.name = name;    
};

spine.SkeletonBinary = function (attachmentLoader) {
    this.attachmentLoader = attachmentLoader;
    this.scale = 1.0;
};
spine.SkeletonBinary.prototype = {
    linkedMeshes:[],
    LinkedMesh:function(mesh, skinName, slotIndex, parent)
    {
        
    },
    readSkin:function(breader, skinName, nonessential)
    {
        var slotCount = breader.readVarint(true);
        if (slotCount === 0) return null;
        var skin = new spine.Skin(skinName);
        for (var i = 0; i < slotCount; i++) {
            var slotIndex = breader.readVarint(true);
            for (var ii = 0, nn = breader.readVarint(true); ii < nn; ii++) {
                var sname = breader.readString();
                skin.addAttachment(slotIndex, sname, this.readAttachment(breader, skin, sname, nonessential));
            }
        }
        return skin;                
    },
    readSkeletonData: function (buffer, name) {
        var breader = new spine.BReader(buffer);
        this.breader = breader;
        var skeletonData = new spine.SkeletonData();
        window.skeletonData = skeletonData;
        
        skeletonData.name = name;

        var scale = this.scale;

        // Skeleton.

        skeletonData.hash = breader.readString();
        skeletonData.version = breader.readString();
        skeletonData.width = breader.readFloat();
        skeletonData.height = breader.readFloat();

        var nonessential = breader.readBoolean();
        if (nonessential) {
            skeletonData.imagesPath = breader.readString();
        }

        // Bones.
        var numbones = breader.readVarint(true);
        for (var i = 0; i < numbones; i++) {
            var bonename = breader.readString();
            var parent_index = breader.readVarint(true)-1;
            
            var parent = null;
            if(i !== 0)
            {
                parent = skeletonData.bones[parent_index];
            }
            var boneData = new spine.BoneData(bonename, parent);
            boneData.x = breader.readFloat() * scale;
            boneData.y = breader.readFloat() * scale;
            boneData.scaleX = breader.readFloat();
            boneData.scaleY = breader.readFloat();
            boneData.rotation = breader.readFloat();
            boneData.length = breader.readFloat() * scale;
            boneData.flipX = breader.readBoolean();
            boneData.flipY = breader.readBoolean();
            boneData.inheritScale = breader.readBoolean();
            boneData.inheritRotation = breader.readBoolean();
            if (nonessential){
                breader.readInt();
            }
            skeletonData.bones.push(boneData);
        }

        // IK constraints.
        var numik = breader.readVarint(true);
        for (var i = 0, n = numik; i < n; i++) {
            var ikConstraintData = new spine.IkConstraintData(breader.readString());
            for (var ii = 0, nn = breader.readVarint(true); ii < nn; ii++)
            {
                ikConstraintData.bones.push(skeletonData.bones[breader.readVarint(true)]);
            }
            ikConstraintData.target = skeletonData.bones[breader.readVarint(true)];
            ikConstraintData.mix = breader.readFloat();
            ikConstraintData.bendDirection = breader.readByte();
            skeletonData.ikConstraints.push(ikConstraintData);
        }

        // Slots.
        var slotscount = breader.readVarint(true);
        for (var i = 0; i < slotscount; i++) {
            var slotName = breader.readString();
            var boneData = skeletonData.bones[breader.readVarint(true)];
            var slotData = new spine.SlotData(slotName, boneData);
            var color = breader.readInt();
            slotData.r = ((color & 0xff000000) >> 24) / 255;
            slotData.g = ((color & 0x00ff0000) >> 16) / 255;
            slotData.b = ((color & 0x0000ff00) >> 8) / 255;
            slotData.a = ((color & 0x000000ff)) / 255;
            slotData.attachmentName = breader.readString();
            slotData.blendMode = breader.readVarint(true);
            skeletonData.slots[i] = slotData;
        }

        // Default skin.
        var defaultSkin = this.readSkin(breader, "default", nonessential);
        if (defaultSkin !== null) {
            skeletonData.defaultSkin = defaultSkin;
            skeletonData.skins.push(defaultSkin);
        }

        // Skins.
        for (var i = 0, n = breader.readVarint(true); i < n; i++)
        {
            skeletonData.skins.push(this.readSkin(breader, breader.readString(), nonessential));
        }
        
        // Events.
        for (var i = 0, n = breader.readVarint(true); i < n; i++) {
            var eventData = new spine.EventData(breader.readString());
            eventData.Int = breader.readVarint(false);
            eventData.Float = breader.readFloat();
            eventData.String = breader.readString();
            skeletonData.events.push(eventData);
        }
        
        // Animations.
        for (var i = 0, n = breader.readVarint(true); i < n; i++)
        {
            this.readAnimation(breader, breader.readString(), skeletonData,i);
        }
        return skeletonData;
    },
    readAttachment: function (breader, skin, name, nonessential) {
        var scale = this.scale;
        name = breader.readString() || name;
        var type = breader.readByte();
        switch (type) {
            case spine.AttachmentType.region: {
                var path = breader.readString() || name;
                var region = this.attachmentLoader.newRegionAttachment(skin, name, path);
                region.Path = path;
                region.x = breader.readFloat() * scale;
                region.y = breader.readFloat() * scale;
                region.scaleX = breader.readFloat();
                region.scaleY = breader.readFloat();
                region.rotation = breader.readFloat();
                region.width = breader.readFloat() * scale;
                region.height = breader.readFloat() * scale;
                var color = breader.readInt();
                region.r = ((color & 0xff000000) >> 24) / 255;
                region.g = ((color & 0x00ff0000) >> 16) / 255;
                region.b = ((color & 0x0000ff00) >> 8) / 255;
                region.a = ((color & 0x000000ff)) / 255;
                region.updateOffset();
                return region;
            }
            case spine.AttachmentType.boundingbox: {
                var vertices = breader.readFloatArray(scale);
                var attachment = this.attachmentLoader.newBoundingBoxAttachment(skin, name);
                for (var i = 0, n = vertices.length; i < n; i++)
                        attachment.vertices.push(vertices[i] * scale);
                return attachment;
            }
            case spine.AttachmentType.mesh: {
                var path = breader.readString() || name;
                
                var mesh = this.attachmentLoader.newMeshAttachment(skin, name, path);
                if (mesh === null) return null;
                
                mesh.path = path;
                
                mesh.vertices = breader.readFloatArray(1);
                mesh.triangles = breader.readShortArray();
                mesh.regionUVs = breader.readFloatArray(scale);
                mesh.UpdateUVs();
                
                var color = breader.readInt();
                mesh.r = ((color & 0xff000000) >> 24) / 255;
                mesh.g = ((color & 0x00ff0000) >> 16) / 255;
                mesh.b = ((color & 0x0000ff00) >> 8) / 255;
                mesh.a = ((color & 0x000000ff)) / 255;
                
                mesh.HullLength = breader.readVarint(true);
                if (nonessential) {
                    mesh.edges = breader.readIntArray();
                    mesh.width = breader.readFloat() * scale;
                    mesh.height = breader.readFloat() * scale;
                }
                return mesh;
            }
            case spine.AttachmentType.skinnedmesh: {
                var path = breader.readString() || name;
                var mesh = this.attachmentLoader.newMeshAttachment(skin, name, path);
                mesh.path = path;
                mesh.regionUVs = breader.readFloatArray();
                mesh.triangles = breader.readShortArray();
                var vertexCount = breader.readVarint(true);
                mesh.weights = [];
                mesh.bones = [];
                
                for (var i = 0; i < vertexCount; i++) {
                    var boneCount = parseInt(breader.readFloat());
                    mesh.bones.push(boneCount);
                    for (var nn = i + boneCount * 4; i < nn; i += 4) {
                        mesh.bones.push(parseInt(breader.readFloat()));
                        mesh.weights.push(breader.readFloat() * scale);
                        mesh.weights.push(breader.readFloat() * scale);
                        mesh.weights.push(breader.readFloat());
                    }
                }
                mesh.UpdateUVs();
                var color = breader.readInt();
                mesh.r = ((color & 0xff000000) >> 24) / 255;
                mesh.g = ((color & 0x00ff0000) >> 16) / 255;
                mesh.b = ((color & 0x0000ff00) >> 8) / 255;
                mesh.a = ((color & 0x000000ff)) / 255;
                mesh.hullLength = breader.readVarint(true);
                if (nonessential) {
                    mesh.edges = breader.readIntArray();
                    mesh.width = breader.readFloat() * scale;
                    mesh.height = breader.readFloat() * scale;
                }
                return mesh;
            }
        }
        return null;
    },
    readAnimation: function (breader, name, skeletonData, animationIndex) {
        var timelines = [];
        var scale = this.scale;
        var duration = 0;
        
        // Slot timelines.
        for (var i = 0, n = breader.readVarint(true); i < n; i++) {
            var slotIndex = breader.readVarint(true);
            for (var ii = 0, nn = breader.readVarint(true); ii < nn; ii++) {
                var timelineType = breader.readByte();
                var frameCount = breader.readVarint(true);
                switch (timelineType) {
                    case TIMELINE_COLOR: {
                        var timeline = new spine.ColorTimeline(frameCount);
                        timeline.slotIndex = slotIndex;
                        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
                            var time = breader.readFloat();
                            var color = breader.readInt();
                            var r = ((color & 0xff000000) >> 24) / 255;
                            var g = ((color & 0x00ff0000) >> 16) / 255;
                            var b = ((color & 0x0000ff00) >> 8) / 255;
                            var a = ((color & 0x000000ff)) / 255;
                            timeline.setFrame(frameIndex, time, r, g, b, a);
                            if (frameIndex < frameCount - 1) {
                                this.readCurve(breader, frameIndex, timeline);
                            }
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 5 - 5]);
                        break;
                    }
                    case TIMELINE_ATTACHMENT: {
                        var timeline = new spine.AttachmentTimeline(frameCount);
                        timeline.slotIndex = slotIndex;
                        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++)
                        {
                            timeline.setFrame(frameIndex, breader.readFloat(), breader.readString());
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);
                        break;
                    }
                }
            }
        }

        // Bone timelines.
        for (var i = 0, n = breader.readVarint(true); i < n; i++) {
            var boneIndex = breader.readVarint(true);
            
            for (var ii = 0, nn = breader.readVarint(true); ii < nn; ii++) {
                var timelineType = breader.readByte();
                var frameCount = breader.readVarint(true);
                switch (timelineType) {
                    case TIMELINE_ROTATE: {
                        var timeline = new spine.RotateTimeline(frameCount);
                        timeline.boneIndex = boneIndex;
                        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
                            timeline.setFrame(frameIndex, breader.readFloat(), breader.readFloat());
                            if (frameIndex < frameCount - 1) 
                            {
                                this.readCurve(breader, frameIndex, timeline);
                            }
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);
                        break;
                    }
                    case TIMELINE_TRANSLATE:
                    case TIMELINE_SCALE: {
                        var timeline = null;
                        var timelineScale = 1;
                        if (timelineType === TIMELINE_SCALE)
                            timeline = new spine.ScaleTimeline(frameCount);
                        else {
                            timeline = new spine.TranslateTimeline(frameCount);
                            timelineScale = this.scale;
                        }
                        timeline.boneIndex = boneIndex;
                        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
                            timeline.setFrame(frameIndex, breader.readFloat(), breader.readFloat() * timelineScale, breader.readFloat() * timelineScale);
                            if (frameIndex < frameCount - 1){
                                this.readCurve(breader, frameIndex, timeline);
                            }
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3]);
                        break;
                    }
                    case TIMELINE_FLIPX:
                    case TIMELINE_FLIPY:
                    {
                        var timeline = null;
                        if(timelineType === TIMELINE_FLIPX)
                        {
                            timeline = new spine.FlipXTimeline(frameCount);
                        }else
                        {
                            timeline = new spine.FlipYTimeline(frameCount);
                        }
                        timeline.boneIndex = boneIndex;
                        for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
                            timeline.setFrame(frameIndex, breader.readFloat(), breader.readBoolean());
                        }
                        timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);
                        break;
                    }
                }
            }
        }

        // IK timelines.
        for (var i = 0, n = breader.readVarint(true); i < n; i++) {
            var ikConstraintIndex = breader.readVarint(true);
            var frameCount = breader.readVarint(true);

            var timeline = new spine.IkConstraintTimeline(frameCount);
            timeline.ikConstraintIndex = ikConstraintIndex;
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {

                var time = breader.readFloat();
                var mix =  breader.readFloat();
                var bendDirection = breader.readSByte();
                timeline.setFrame(frameIndex, time, mix, bendDirection);
                if (frameIndex < frameCount - 1){
                    this.readCurve(breader, frameIndex, timeline);
                }
            }
            timelines.push(timeline);
            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3]);
        }

        // FFD timelines.
        for (var i = 0, n = breader.readVarint(true); i < n; i++) {
            var skin = skeletonData.skins[breader.readVarint(true)];
            for (var ii = 0, nn = breader.readVarint(true); ii < nn; ii++) {
                var slotIndex = breader.readVarint(true);
                for (var iii = 0, nnn = breader.readVarint(true); iii < nnn; iii++) {
                    var attachment = skin.GetAttachment(slotIndex, breader.readString());
                    var frameCount = breader.readVarint(true);
                    var timeline = new spine.FfdTimeline(frameCount);
                    timeline.slotIndex = slotIndex;
                    timeline.attachment = attachment;
                    for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
                        var time = breader.readFloat();
                        var vertices = [];
                        
                        var isMesh = attachment.type == spine.AttachmentType.mesh;
                        var vertexCount;
                        if (isMesh)
                            vertexCount = attachment.vertices.length;
                        else
                            vertexCount = attachment.weights.length / 3 * 2;

                        var end = breader.readVarint(true);
                        if (end == 0) {
                            vertices = attachment.vertices || [];
                        } else {
                            vertices = [];
                            var start = breader.readVarint(true);
                            end += start;
                            if (scale == 1) {
                                for (var v = start; v < end; v++)
                                    vertices[v] = breader.readFloat();
                            } else {
                                for (var v = start; v < end; v++)
                                    vertices[v] = breader.readFloat() * scale;
                            }
                            if (isMesh) {
                                var meshVertices = attachment.vertices;
                                for (var v = 0, vn = vertices.length; v < vn; v++)
                                    vertices[v] += meshVertices[v];
                            }
                        }
                        timeline.setFrame(frameIndex, time, vertices);
                        if (frameIndex < frameCount - 1){
                            this.readCurve(breader, frameIndex, timeline);
                        }
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[frameCount - 1]);
                }
            }
        }

        // Draw order timeline.
        var drawOrderCount = breader.readVarint(true);
        if (drawOrderCount > 0) {
            var timeline = new spine.DrawOrderTimeline(drawOrderCount);
            var slotCount = skeletonData.slots.Count;
            for (var i = 0; i < drawOrderCount; i++) {
                var offsetCount = ReadVarint(true);
                var drawOrder = [];
                for (var ii = slotCount - 1; ii >= 0; ii--)
                    drawOrder[ii] = -1;
                var unchanged = [];
                var originalIndex = 0, unchangedIndex = 0;
                for (var ii = 0; ii < offsetCount; ii++) {
                    var slotIndex = breader.readVarint(true);
                    // Collect unchanged items.
                    while (originalIndex != slotIndex)
                            unchanged[unchangedIndex++] = originalIndex++;
                    // Set changed items.
                    drawOrder[originalIndex + breader.readVarint(true)] = originalIndex++;
                }
                // Collect remaining unchanged items.
                while (originalIndex < slotCount)
                    unchanged[unchangedIndex++] = originalIndex++;
                // Fill in unchanged items.
                for (var ii = slotCount - 1; ii >= 0; ii--)
                    if (drawOrder[ii] == -1) drawOrder[ii] = unchanged[--unchangedIndex];
                timeline.setFrame(i, breader.readFloat(), drawOrder);
            }
            timelines.push(timeline);
            duration = Math.max(duration, timeline.frames[drawOrderCount - 1]);
        }

        // Event timeline.
        var eventCount = breader.readVarint(true);
        if (eventCount > 0) {
            var timeline = new spine.EventTimeline(eventCount);
            for (var i = 0; i < eventCount; i++) {
                var time = breader.readFloat();
                var eventData = skeletonData.events[breader.readVarint(true)];
                var e = new spine.Event(eventData);
                e.intValue = breader.readVarint(false);
                e.floatValue = breader.readFloat();
                e.stringValue = breader.readBoolean() ? breader.readString() : eventData.String;
                timeline.setFrame(i,time, e);
            }
            timelines.push(timeline);
            duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);
        }
        var animation = new spine.Animation(name, timelines, duration);
        skeletonData.animations[animationIndex] = animation;
    },
    readCurve: function (breader, frameIndex, timeline) {
        switch (breader.readByte()) {
            case CURVE_STEPPED:
                timeline.curves.setStepped(frameIndex);
                break;
            case CURVE_BEZIER:
                timeline.curves.setCurve(frameIndex, breader.readFloat(), breader.readFloat(), breader.readFloat(), breader.readFloat());
                break;
            default:
                timeline.curves.setLinear(frameIndex);
                break;
        }
    }
};