import { Scene, type Node } from 'cc';
import { RigidBody2D } from './rigid-body-2d.js';
import { Collider2D } from './collider-2d.js';
import { logger } from '@cyclonium/core/log';

export class BodyColliderLink {
  constructor(rigidBody: RigidBody2D) {
    this._rigidBody = rigidBody;
  }

  get rigidBody() {
    return this._rigidBody;
  }

  get colliders() {
    return this._colliders;
  }

  disband() {
    for (const collider of this._colliders) {
      collider._enableCollisionEventsSinceBody(false);
      collider._responseToBodyCollisionGroups(0);
      collider._responseToBodySolverGroups(0);
      collider._responseToBodyActiveCollisionTypes(0);
    }
    this._colliders.length = 0;
  }

  linkCollider(collider: Collider2D) {
    if (this._colliders.indexOf(collider) >= 0) {
      throw new Error(`Collider ${collider.name} already joined to body ${this._rigidBody?.name}.`);
    }
    this._colliders.push(collider);
    if (this._isBodyRequiresCollisionEvents) {
      collider._enableCollisionEventsSinceBody(true);
    }
    collider._responseToBodyCollisionGroups(this._bodyCollisionGroups);
    collider._responseToBodySolverGroups(this._bodySolverGroups);
    collider._responseToBodyActiveCollisionTypes(this._bodyActiveCollisionTypes);
  }

  removeCollider(collider: Collider2D) {
    const index = this._colliders.indexOf(collider);
    if (index >= 0) {
      this._colliders.splice(index, 1);
      return true;
    }
    return false;
  }

  enableCollisionEventsFromBody(value: boolean) {
    this._isBodyRequiresCollisionEvents = value;
    for (const collider of this._colliders) {
      collider._enableCollisionEventsSinceBody(value);
    }
  }

  setBodyActiveCollisionTypes(value: number) {
    this._bodyActiveCollisionTypes = value;
    for (const collider of this._colliders) {
      collider._responseToBodyActiveCollisionTypes(value);
    }
  }

  setBodyCollisionGroups(value: number) {
    this._bodyCollisionGroups = value;
    for (const collider of this._colliders) {
      collider._responseToBodyCollisionGroups(value);
    }
  }

  setBodySolverGroups(value: number) {
    this._bodySolverGroups = value;
    for (const collider of this._colliders) {
      collider._responseToBodySolverGroups(value);
    }
  }

  private _rigidBody: RigidBody2D;
  private _colliders: Collider2D[] = [];
  private _isBodyRequiresCollisionEvents = false;
  private _bodyActiveCollisionTypes: number = 0;
  private _bodyCollisionGroups: number = 0;
  private _bodySolverGroups: number = 0;
}

export class BodyColliderLinkManager {
  getLinkedRigidBody(collider: Collider2D) {
    return this._colliderLinks.get(collider) ?? null;
  }

  joinRigidBody(rigidBody: RigidBody2D) {
    if (rigidBody.node.getComponents(RigidBody2D).length > 1) {
      throw new Error(`RigidBody is not unique in node ${rigidBody.node.name}.`);
    }
    if (this._rigidBodyLinks.has(rigidBody)) {
      throw new Error(`RigidBody ${rigidBody.name} already joined.`);
    }
    const link: BodyColliderLink = new BodyColliderLink(rigidBody);
    this._rigidBodyLinks.set(rigidBody, link);
    for (const collider of this._findBelongingColliders(rigidBody)) {
      const oldLink = this._colliderLinks.get(collider);
      if (oldLink === undefined) {
        // Never joined.
        continue;
      }
      if (oldLink) {
        logger.warn(`Note: relinking collider ${collider.name} to body ${rigidBody.name}(previous: ${oldLink.rigidBody.name}).`);
        oldLink.removeCollider(collider);
      }
      link.linkCollider(collider);
      this._colliderLinks.set(collider, link);
    }
    return link;
  }

  removeRigidBody(rigidBody: RigidBody2D) {
    const link = this._rigidBodyLinks.get(rigidBody);
    if (!link) {
      return false;
    }
    // TODO: should relink colliders to another body?
    for (const collider of link.colliders) {
      this._colliderLinks.set(collider, null);
    }
    link.disband();
    this._rigidBodyLinks.delete(rigidBody);
    return true;
  }

  joinCollider(collider: Collider2D) {
    const attachedRigidBody = this._findRigidBodyToAttach(collider);
    const bodyLink = attachedRigidBody
      ? this._rigidBodyLinks.get(attachedRigidBody) ?? null
      : null;
    if (bodyLink) {
      bodyLink.linkCollider(collider);
    }
    this._colliderLinks.set(collider, bodyLink);
  }

  removeCollider(collider: Collider2D) {
    const bodyLink = this._colliderLinks.get(collider);
    if (bodyLink === undefined) {
      // Never joined.
      return false;
    }
    if (!bodyLink) {
      // Joined, but not linked to a rigid body.
      return true;
    }
    const success = bodyLink.removeCollider(collider);
    return success;
  }

  private _colliderLinks = new Map<Collider2D, BodyColliderLink | null>();

  private _rigidBodyLinks = new Map<RigidBody2D, BodyColliderLink>();

  private _findRigidBodyToAttach(collider: Collider2D): RigidBody2D | null {
    for (let current: Node | null = collider.node; current && !(current instanceof Scene); current = current.parent) {
      const rigidBody = RigidBody2D.ofOrNull(current);
      if (rigidBody) {
        return rigidBody;
      }
    }
    return null;
  }

  private* _findBelongingColliders(rigidBody: RigidBody2D): Generator<Collider2D> {
    yield* lsNode(rigidBody.node);

    function* lsNode(node: Node): Generator<Collider2D> {
      const colliders = node.getComponents(Collider2D);
      yield* colliders;
      for (const child of node.children) {
        if (RigidBody2D.ofOrNull(child)) {
          continue;
        }
        yield* lsNode(child);
      }
    }
  }
}
