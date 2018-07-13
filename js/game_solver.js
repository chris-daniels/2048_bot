function GameSolver() {
	this.autoSolving = false;
}

GameSolver.prototype.getBestMove = function (grid) {
	this.size = grid.size;

	var bestMoveObject = this.searchDecisionTree(grid, 0);

	var bestScore = bestMoveObject.score;
	var bestDirection = bestMoveObject.direction;

	//if we didn't find any "scoring move", choose a random direction
	if(bestScore === -1){
		bestDirection = Math.floor(Math.random() * 3.999);
	}

	return bestDirection;
};

GameSolver.prototype.searchDecisionTree = function(grid, depth){

	var maxScore = -1;
	var maxDirection = -1;

	/*
	* Base cases:
	* 1. no moves are available. we lost.
	* 2. we are 8 levels deep in the recusion tree. we need to return for performance's sake
	*/
	if(!this.movesAvailable(grid) || depth > 8){
		return {
			"direction": maxDirection,
			"score": maxScore
		}
	}

	//could prune further here
	// directifonInfo = this.prune(directionInfo, depth);

	for(var i = 0; i < 4; i++){

		var newScore = -1;
		//if it's shallow in the decision tree, we are going to sample for multiple random events
		if(depth <= 1){
			var newGrid1 = this.cloneGrid(grid);
			var directionScore1 = this.move(newGrid1, i);
			var prospectiveScore1 = directionScore1+ ((0.8) * (this.searchDecisionTree(newGrid1, depth + 1).score));

			var newGrid2 = this.cloneGrid(grid);
			var directionScore2 = this.move(newGrid2, i);
			var prospectiveScore2 = directionScore2 + ((0.8) * (this.searchDecisionTree(newGrid2, depth + 1).score));

			newScore = prospectiveScore1 > prospectiveScore2 ? prospectiveScore2 : prospectiveScore1;	
		}
		//mid depth, explore single random event in all directions
		else if(depth > 1 && depth <=4){
			var newGrid1 = this.cloneGrid(grid);
			var directionScore1 = this.move(newGrid1, i);
			var newScore = directionScore1 + ((0.8) * (this.searchDecisionTree(newGrid1, depth + 1).score));
		}
		//max depth, only look at "scoring moves"
		else {
			var newGrid1 = this.cloneGrid(grid);
			var directionScore1 = this.move(newGrid1, i);
			if(directionScore1 > 0){
				newScore = directionScore1+ ((0.8) * (this.searchDecisionTree(newGrid1, depth + 1).score));
			}
		}

		if(newScore > maxScore) {
			maxScore = newScore;
			maxDirection = i;
		}
	}

	return {
		"direction": maxDirection,
		"score": maxScore
	};
}

// Move tiles on the grid in the specified direction
GameSolver.prototype.move = function (grid, direction) {

  // 0: up, 1: right, 2: down, 3: left
  var self = this;
  var score = 0;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles(grid);

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = grid.cellContent(cell);


      if (tile) {
        var positions = self.findFarthestPosition(cell, vector, grid);
        var next      = grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          grid.insertTile(merged);
          grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest, grid);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile(grid);

    if (!this.movesAvailable(grid)) {
      this.over = true; // Game over!
    }

  }

  return score;
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameSolver.prototype.isGameTerminated = function (grid) {
	return false;
};


// Get the vector representing the chosen direction
GameSolver.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameSolver.prototype.buildTraversals = function (vector) {

  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

// Save all tile positions and remove merger info
GameSolver.prototype.prepareTiles = function (grid) {
  grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

GameSolver.prototype.findFarthestPosition = function (cell, vector, grid) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (grid.withinBounds(cell) &&
           grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};


// Move a tile and its representation
GameSolver.prototype.moveTile = function (tile, cell, grid) {
  grid.cells[tile.x][tile.y] = null;
  grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameSolver.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};


// Adds a tile in a random position
GameSolver.prototype.addRandomTile = function (grid) {
  if (grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(grid.randomAvailableCell(), value);

    grid.insertTile(tile);
  }
};

GameSolver.prototype.movesAvailable = function (grid) {
  return grid.cellsAvailable() || this.tileMatchesAvailable(grid);
};

// Check for available matches between tiles (more expensive check)
GameSolver.prototype.tileMatchesAvailable = function (grid) {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameSolver.prototype.movesAvailable = function (grid) {
  return grid.cellsAvailable() || this.tileMatchesAvailable(grid);
};

GameSolver.prototype.cloneGrid = function (grid){
	var newGrid = new Grid();
	newGrid.size = grid.size;

	newGrid.cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = [];

    for (var y = 0; y < this.size; y++) {
      var tile = grid.cells[x][y];
      row.push(tile ? new Tile({x:tile.x, y:tile.y}, tile.value) : null);
    }
    newGrid.cells.push(row);
  }

	return newGrid;
}

GameSolver.prototype.equal = function (oldGrid, newGrid){

	for (var x = 0; x < this.size; x++) {
    	var row = [];

    	for (var y = 0; y < this.size; y++) {
    		if(oldGrid.cells[x][y] && newGrid.cells[x][y]){
    			if(oldGrid.cells[x][y].value !== newGrid.cells[x][y].value){
    				return false;
    			}
    		}
    		else if(oldGrid.cells[x][y] !== newGrid.cells[x][y]){
    			return false;
    		}
    	}
    }

    return true;

};