/** Koerper der Headless-Physik: lokale Form, Welt-Transformation, Masse und Traegheit. */
export interface Vec2 { readonly x: number; readonly y: number }

type Shape =
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'segment'; readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number }
  | { readonly kind: 'polygon'; readonly points: readonly Vec2[] };

export interface Body {
  readonly id: number;
  readonly shape: Shape;
  position: Vec2;
  velocity: Vec2;
  rotation: number;
  angularVelocity: number;
  readonly mass: number;
  readonly inverseMass: number;
  readonly inertia: number;
  readonly inverseInertia: number;
  readonly friction: number;
  readonly restitution: number;
  readonly isStatic: boolean;
  /** Radius um den Schwerpunkt, der die Form vollstaendig umschliesst (Breitphase). */
  readonly boundingRadius: number;
  /** Federnder Peg: gibt mehr Energie zurueck als ein normales Hindernis. */
  readonly bouncy: boolean;
  /** Name der Zone, in der der Koerper als Trigger wirkt (Tasche, Splitter, Tor). */
  readonly trigger: string | null;
}

interface BodyOptions {
  readonly position?: Vec2;
  readonly velocity?: Vec2;
  readonly rotation?: number;
  readonly angularVelocity?: number;
  readonly mass?: number;
  readonly static?: boolean;
  readonly friction?: number;
  readonly restitution?: number;
  readonly bouncy?: boolean;
  readonly trigger?: string;
}

const ORIGIN: Vec2 = { x: 0, y: 0 };

/** Traegheit eines Koerpers um seinen Schwerpunkt; statische Koerper haben keine. */
function inertiaOf(shape: Shape, mass: number): number {
  if (mass <= 0) return 0;
  if (shape.kind === 'circle') return 0.5 * mass * shape.radius * shape.radius;
  if (shape.kind === 'segment') {
    const length = Math.hypot(shape.bx - shape.ax, shape.by - shape.ay);
    return (mass * length * length) / 12;
  }
  let extent = 0;
  for (const point of shape.points) extent = Math.max(extent, Math.hypot(point.x, point.y));
  return (mass * extent * extent) / 2;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`Physik: ${label} muss endlich sein, erhalten ${String(value)}`);
}

function assertShape(shape: Shape): void {
  if (shape.kind === 'circle' && !(shape.radius > 0)) {
    throw new Error(`Physik: Radius muss positiv sein, erhalten ${String(shape.radius)}`);
  }
  if (shape.kind === 'segment' && Math.hypot(shape.bx - shape.ax, shape.by - shape.ay) <= 0) {
    throw new Error('Physik: Segment braucht zwei verschiedene Punkte');
  }
  if (shape.kind === 'polygon' && shape.points.length < 3) {
    throw new Error(`Physik: Polygon braucht mindestens drei Punkte, erhalten ${shape.points.length}`);
  }
}

let nextId = 1;

export function createBody(shape: Shape, options: BodyOptions = {}): Body {
  assertShape(shape);
  const isStatic = options.static ?? true;
  const mass = isStatic ? 0 : (options.mass ?? 1);
  const boundingRadius = shape.kind === 'circle'
    ? shape.radius
    : shape.kind === 'segment'
      ? Math.max(Math.hypot(shape.ax, shape.ay), Math.hypot(shape.bx, shape.by))
      : shape.points.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);
  if (!Number.isFinite(mass) || mass < 0) throw new Error(`Physik: Masse ${String(mass)} ist ungueltig`);
  assertFinite(options.position?.x ?? 0, 'position.x');
  assertFinite(options.position?.y ?? 0, 'position.y');
  const inertia = inertiaOf(shape, mass);
  return {
    id: nextId++,
    shape,
    position: options.position ?? ORIGIN,
    velocity: options.velocity ?? ORIGIN,
    rotation: options.rotation ?? 0,
    angularVelocity: options.angularVelocity ?? 0,
    mass,
    inverseMass: mass > 0 ? 1 / mass : 0,
    inertia,
    inverseInertia: inertia > 0 ? 1 / inertia : 0,
    friction: options.friction ?? 0.4,
    restitution: options.restitution ?? 0.35,
    isStatic,
    boundingRadius,
    bouncy: options.bouncy ?? false,
    trigger: options.trigger ?? null,
  };
}

/** Statische Form ohne Masse: Peg, Planke, Kesselwand, Trigger. */
export function staticBody(shape: Shape, options: BodyOptions = {}): Body {
  return createBody(shape, { ...options, static: true });
}

/** Dynamischer Ball mit Masse, Traegheit und eigener Rotation. */
export function ballBody(radius: number, options: BodyOptions = {}): Body {
  return createBody({ kind: 'circle', radius }, { restitution: 0.45, friction: 0.3, ...options, static: false });
}

/** Lokale Punkte einer Form in Weltkoordinaten. */
export function worldPoints(body: Body): Vec2[] {
  if (body.shape.kind === 'circle') return [body.position];
  const cos = Math.cos(body.rotation);
  const sin = Math.sin(body.rotation);
  const point = (x: number, y: number): Vec2 => ({
    x: body.position.x + x * cos - y * sin,
    y: body.position.y + x * sin + y * cos,
  });
  if (body.shape.kind === 'segment') {
    return [point(body.shape.ax, body.shape.ay), point(body.shape.bx, body.shape.by)];
  }
  return body.shape.points.map((entry) => point(entry.x, entry.y));
}
