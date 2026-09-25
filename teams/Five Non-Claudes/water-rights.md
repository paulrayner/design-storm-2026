# Water rights behind the tunnels

Everything in this file is **general knowledge**, not something from Cassidi's
deck, Jake's materials, or Denver Water — verify with Denver Water before
relying on it for anything published. It exists because two of the four
basins feeding Foothills (see [`water-system-3d/README.md`](../../water-system-3d/README.md))
cross the Continental Divide, and that crossing is not a free lunch.

![Diagram of the Blue River and Fraser River diversions as a one-way move()
between two unsynced clusters: the Blue River move can be preempted by Green
Mountain Reservoir's older claim, the Fraser River move carries an SLA of
minimum flow and maximum temperature checked by a live monitoring loop, and
Williams Fork Reservoir issues a compensating write back to the shared river
to settle both.](water-rights-diagram.svg)

*Denver's diversions aren't a free `GET`: each one carries a runtime
constraint that can throttle it, bind it to an SLA, or require a
compensating write elsewhere to keep the West Slope's balance whole.*

## The basic rule: whoever claimed it first, gets it first

Colorado water rights run on **prior appropriation**: "first in time, first
in right." The person or utility who started using a stretch of river first
holds the senior claim, and in a shortage, senior claims get filled before
junior ones, no matter who needs the water more. A right is also tied to a
*use* and a *place*, so moving water somewhere else, or using it for
something else, generally needs a decree saying so.

**Trans-mountain diversions are the sharpest version of this fight.** Water
that crosses the Continental Divide never comes back to the basin it left.
Every gallon Denver takes from the Blue River or the Fraser is a gallon the
Colorado River basin permanently does not get, which is why both diversions
came with conditions attached rather than a clean claim.

## Blue River: a senior downstream right can throttle Denver's tunnel

Denver draws from Dillon Reservoir through the 23-mile **Roberts Tunnel**.
Downstream on the same river sits **Green Mountain Reservoir**, built for
hydropower and to replace water for other Western Slope users, and its claim
predates Denver's. Under the 1955 **Blue River Decree** (a consent decree,
not a one-off ruling — read: still-binding, still in force), Green Mountain's
senior right can be invoked against Denver's diversion. In a dry year, that
can mean less water through Roberts Tunnel, or a required minimum release
past Dillon, so Denver doesn't get an unconditional tap.

## Fraser River: the price of more capacity was a running commitment, not a one-time payment

Denver's Fraser River take feeds the **Moffat Tunnel** into the North Boulder
Creek side of the system, and it went through **Gross Reservoir**, which
Denver expanded to hold more of it. Grand County and West Slope conservation
groups did not sign off on that expansion for free. The terms — the
**Colorado River Cooperative Agreement** (2013) and the **Learning By Doing**
program — commit Denver to minimum stream flows and temperature limits in the
Fraser, monitored on an ongoing basis and adjusted as conditions change,
rather than settled once and forgotten.

## Williams Fork Reservoir: paying it back on a separate account

**Williams Fork Reservoir**, on the Colorado River side, exists partly to
settle up. Denver releases water from it into the Colorado River mainstem to
compensate the West Slope for what the Blue River and Fraser diversions took.
It's an exchange, not a refund of the same water — since what went through
the tunnels is gone for good, Denver balances the books with water it holds
separately on the west side of the divide.

## Why this might matter for the challenge

None of this changes what's in `data/`, but it's context for anyone modeling
flow or availability upstream of Strontia: what reaches the South Platte
isn't just "how much snow fell." In a dry year, a Green Mountain priority
call or a Fraser flow commitment can change how much of that west-slope water
actually shows up, independent of snowpack.
