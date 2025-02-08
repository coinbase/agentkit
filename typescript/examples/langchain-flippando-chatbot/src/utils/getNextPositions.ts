function getNextPositions(board: number[], solvedBoard: number[]): number[] | null {
    const boardSize: number = board.length
  
    // Helper function to find the next position that is 0 in both board and solvedBoard
    function findNextZeroPosition(startIndex: number): number {
      for (let i = 0; i < boardSize; i++) {
        const index: number = (startIndex + i) % boardSize
        if (board[index] === 0 && solvedBoard[index] === 0) {
          return index
        }
      }
      return -1 // This happens when there are no more positions to flip
    }
  
    // Find the first position to flip
    const firstPosition: number = findNextZeroPosition(0)
  
    // If we don't have any positions to flip, the game is over or in an invalid state
    if (firstPosition === -1) {
      return null
    }
  
    // Find the second position to flip, starting from the position after the first one
    const secondPosition: number = findNextZeroPosition((firstPosition + 1) % boardSize)
  
    // If we can't find a second position, or if it's the same as the first, the game is in an invalid state
    if (secondPosition === -1 || secondPosition === firstPosition) {
      return null
    }
  
    return [firstPosition, secondPosition]
  }
  
  export { getNextPositions }
  
  