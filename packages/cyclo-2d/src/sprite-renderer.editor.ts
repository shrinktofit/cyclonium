import { Vec2 } from '@cyclonium/core/math/vec2';
import { ComponentEditor, type SceneGuiContext } from '@cyclonium/editor';
import { Color, componentEditorTraits } from 'cc';
import { SpriteRenderer } from './sprite-renderer.component.js';

@ComponentEditor.LegacyDecorators.attachTo(SpriteRenderer)
export class SpriteRendererEditor extends ComponentEditor<SpriteRenderer> {
  protected override onSceneGUI(ctx: SceneGuiContext): void {
    const bounds = this.target[componentEditorTraits.BoundingComponent.Tags.getBoundingBox]();
    if (!bounds) {
      return;
    }

    const { center, halfExtents } = bounds;
    const outlineHalfExtents = new Vec2(
      halfExtents.x + lineThickness * 0.5,
      halfExtents.y + lineThickness * 0.5,
    );
    ctx.handles.color = boundingFrameColor;
    ctx.handles.drawPolyline2D({
      points: [
        new Vec2(center.x - outlineHalfExtents.x, center.y - outlineHalfExtents.y),
        new Vec2(center.x - outlineHalfExtents.x, center.y + outlineHalfExtents.y),
        new Vec2(center.x + outlineHalfExtents.x, center.y + outlineHalfExtents.y),
        new Vec2(center.x + outlineHalfExtents.x, center.y - outlineHalfExtents.y),
      ],
      close: true,
      thickness: lineThickness,
      z: center.z + zOffset,
    });
  }
}

const boundingFrameColor = new Color(255, 190, 82, 255);
const lineThickness = 0.02;
const zOffset = 0.01;
