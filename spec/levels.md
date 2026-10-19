The game functions as such:

There is a shared hub world. Players can join this hub would together and share the same state. The hub world is an 11x11 scene. No enemies are there. Players can move freely, and can overlap. Entities of the same type can occupy the same square. When rendering, if multiple entities are on the same tile, they are shifted by a consistent random amount (preferring the active player on top).

Then players can type a command to render the dungeon. For that, each player gets their own level. The levels are pregenerated ahead of time and have different challenges. These levels are smaller too.

If there are enemies in the level, player movement is limited to 2 squares in each direction. If there are none, players may move freely.