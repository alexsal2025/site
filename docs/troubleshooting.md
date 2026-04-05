# Troubleshooting

## `This player is already online!`

Possible causes:

- a previous bot session is still connected
- the server has not yet cleared the old session
- another process is using the same username

What to do:

- stop any old bot process
- wait a little and reconnect
- change the bot username temporarily to verify the issue

## `Login timed out!`

Possible causes:

- `LoginSecurity` is enabled but `LOGIN_SECURITY_PASSWORD` is empty
- the plugin expects `/login` or `/register` earlier than your current delay

What to do:

- set `LOGIN_SECURITY_PASSWORD` in `.env`
- lower `LOGIN_SECURITY_COMMAND_DELAY_MS`
- check the server chat prompt text and plugin behavior

## LLM API returns `500 Internal Server Error`

Possible causes:

- the endpoint path is incorrect
- the provider uses a different request schema
- the provider itself is temporarily failing

What to do:

- verify `LLM_BASE_URL` and `LLM_CHAT_COMPLETIONS_PATH`
- test the API separately with `curl`
- switch to fallback/local behavior while the provider is unavailable

## `No path to the goal!`

Possible causes:

- the pathfinder cannot reach the target block
- the target is underground, blocked, or too far away
- terrain around the bot is not walkable

What to do:

- move the bot to a simpler open area
- reduce the distance to the target
- try again after changing the environment around the bot

## Bot does not chat

Possible causes:

- chat cooldown is too long
- the message does not match one of the supported commands
- the bot is busy with another task

What to do:

- reduce `CHAT_REPLY_COOLDOWN_MS`
- test with a simple command like `где ты`
- wait until the current task finishes
