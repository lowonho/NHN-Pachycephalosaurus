export const VIEWPORT = { width: 960, height: 540 };

export const BALL_RADIUS = 12;
export const MAZE = {
  columns: 13,
  rows: 7,
  cell: 64,
  x: 64,
  y: 46,
  wall: 10,
};

export const START_CELL = { column: 0, row: 6 };
export const GOAL_CELL = { column: 9, row: 2 };

function cellCenter({ column, row }) {
  return {
    x: MAZE.x + column * MAZE.cell + MAZE.cell / 2,
    y: MAZE.y + row * MAZE.cell + MAZE.cell / 2,
  };
}

export const START = cellCenter(START_CELL);
export const GOAL = { ...cellCenter(GOAL_CELL), radius: 22 };

export const PHYSICS = {
  timeLimit: 20.26,
  baseAcceleration: 610,
  baseMaxSpeed: 190,
  maxMultiplier: 3.35,
  goalMaxSpeed: 110,
  goalHoldSeconds: 0.35,
};

const DIRECTIONS = [
  { key: "up", dc: 0, dr: -1, opposite: "down" },
  { key: "right", dc: 1, dr: 0, opposite: "left" },
  { key: "down", dc: 0, dr: 1, opposite: "up" },
  { key: "left", dc: -1, dr: 0, opposite: "right" },
];

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createMaze(seed = 20260328) {
  const random = seededRandom(seed);
  const cells = Array.from({ length: MAZE.rows }, (_, row) =>
    Array.from({ length: MAZE.columns }, (_, column) => ({
      column,
      row,
      visited: false,
      walls: { up: true, right: true, down: true, left: true },
    })),
  );

  const start = cells[START_CELL.row][START_CELL.column];
  start.visited = true;
  const stack = [start];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = DIRECTIONS
      .map((direction) => ({
        direction,
        column: current.column + direction.dc,
        row: current.row + direction.dr,
      }))
      .filter(({ column, row }) =>
        column >= 0 && column < MAZE.columns && row >= 0 && row < MAZE.rows && !cells[row][column].visited,
      );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const nextChoice = candidates[Math.floor(random() * candidates.length)];
    const next = cells[nextChoice.row][nextChoice.column];
    current.walls[nextChoice.direction.key] = false;
    next.walls[nextChoice.direction.opposite] = false;
    next.visited = true;
    stack.push(next);
  }

  return cells;
}

export const MAZE_CELLS = createMaze();

function makeWallRectangles(cells) {
  const walls = [];
  const { x, y, cell, wall, columns, rows } = MAZE;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const current = cells[row][column];
      const left = x + column * cell;
      const top = y + row * cell;

      if (row === 0 && current.walls.up) {
        walls.push({ x: left - wall / 2, y: top - wall / 2, w: cell + wall, h: wall, kind: "outer" });
      }
      if (column === 0 && current.walls.left) {
        walls.push({ x: left - wall / 2, y: top - wall / 2, w: wall, h: cell + wall, kind: "outer" });
      }
      if (current.walls.right) {
        walls.push({
          x: left + cell - wall / 2,
          y: top - wall / 2,
          w: wall,
          h: cell + wall,
          kind: column === columns - 1 ? "outer" : "hedge",
        });
      }
      if (current.walls.down) {
        walls.push({
          x: left - wall / 2,
          y: top + cell - wall / 2,
          w: cell + wall,
          h: wall,
          kind: row === rows - 1 ? "outer" : "hedge",
        });
      }
    }
  }
  return walls;
}

export const WALLS = makeWallRectangles(MAZE_CELLS);

export function solutionCells(cells, start = START_CELL, goal = GOAL_CELL) {
  const startKey = `${start.column},${start.row}`;
  const goalKey = `${goal.column},${goal.row}`;
  const queue = [start];
  const previous = new Map([[startKey, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = `${current.column},${current.row}`;
    if (currentKey === goalKey) break;
    const cell = cells[current.row][current.column];

    for (const direction of DIRECTIONS) {
      if (cell.walls[direction.key]) continue;
      const next = { column: current.column + direction.dc, row: current.row + direction.dr };
      const key = `${next.column},${next.row}`;
      if (previous.has(key)) continue;
      previous.set(key, current);
      queue.push(next);
    }
  }

  const path = [];
  let cursor = goal;
  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(`${cursor.column},${cursor.row}`);
  }
  return path;
}

function directionBetween(from, to) {
  if (to.column > from.column) return "right";
  if (to.column < from.column) return "left";
  if (to.row > from.row) return "down";
  return "up";
}

function compressRoute(path) {
  if (path.length < 2) return [];
  const route = [];
  let currentDirection = directionBetween(path[0], path[1]);

  for (let index = 2; index < path.length; index += 1) {
    const nextDirection = directionBetween(path[index - 1], path[index]);
    if (nextDirection !== currentDirection) {
      route.push({ ...cellCenter(path[index - 1]), input: currentDirection });
      currentDirection = nextDirection;
    }
  }
  route.push({ ...cellCenter(path[path.length - 1]), input: currentDirection });
  return route;
}

export const SOLUTION_CELLS = solutionCells(MAZE_CELLS);
export const ROUTE = compressRoute(SOLUTION_CELLS);
export const RECOMMENDED_INPUTS = ROUTE.length;

