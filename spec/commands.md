# Command Specification

This document details the command syntax, parsing rules, and execution behavior for player inputs in the game. Commands are given via email replies (and also via the debugging UI)

---

# How commands should work:

The player can only move their current character. Commands look like the following:

up 2
down 1
left 3
south 2
left

up down left right, north east south west are all allowed as directions. The number is the number of spaces to move. Leave it out defaults to moving 1 tile.

There's also the wait command where the character doesn't move:

wait

### Coordinate commands:

Players can also move directly to a specific coordinate:

a1
l19
m10

The letter indicates the column (starting from 'a' at the left) and the number indicates the row (starting from '1' at the bottom).
If the player is unable to move to a location because there are enemies (movement is limited to 2 squares in cardinal directions when enemies are present), the command will not work.
