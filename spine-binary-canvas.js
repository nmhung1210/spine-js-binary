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

spine.SkeletonRenderer.prototype.loadBinary = function(buffer)
{
    var imagesPath = this.imagesPath;
    var bin = new spine.SkeletonBinary({
            newRegionAttachment: function (skin, name, path) {
                var image = new Image();
                image.src = imagesPath + path + ".png";
                var attachment = new spine.RegionAttachment(name);
                attachment.rendererObject = image;
                return attachment;
            },
            newBoundingBoxAttachment: function (skin, name) {
                return new spine.BoundingBoxAttachment(name);
            }
    });
    bin.scale = this.scale;
    this.skeletonData = bin.readSkeletonData(buffer);
    spine.Bone.yDown = true;
    this.skeleton = new spine.Skeleton(this.skeletonData);
    var stateData = new spine.AnimationStateData(this.skeletonData);
    this.state = new spine.AnimationState(stateData);
};
	