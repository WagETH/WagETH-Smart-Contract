# [WagETH](https://www.wageth.com)

 WagETH is a high stakes king of the hill game hosted on the Ethereum Blockchain using smart contracts to guarantee transparency and fairness.

The game mechanic is simple:

* An initial pot of some amount of Ethereum is injected into the game contract
* Users can then bid to be 'king' of the pot, their bids are added to the pot
* The highest bidder is the king
* When the king is replaced by a new high bidder the game extends 60 minutes
* After 60 minutes without a change in king - the king is paid the pot (minus fees) and a new game is started

## How To Play

Anyone can participate by simply sending Ether to the smart contract address.

Participants must make sure to only send wagers from wallets they have full control over. More specifically, bids should not be sent from an exchange or mining wallets.

Suggested wallets are [MyEtherWallet](https://www.myetherwallet.com/), [Jaxx](https://jaxx.io/), Mist or Parity.

## WagETH.com

The live game is visible at [https://www.wageth.com](https://www.wageth.com), a meteor based web app which interfaces with the deployed smart contract. It manages automatically ending the game and forcing the distribution of prizes to winners and covers all gas/marketing costs for which a fee is charged. The fees taken from the final pot include:

* 10% to the host
* 5% rollover into the next game

## Trustless

WagETH's contract is designed to operate trustlessly:

* The end of the game can be triggered after 60 minutes by any user, guaranteeing that the host cannot hold a prize to ransom
* Fees charged to participate in a game cannot be arbitrarily changed during a game
* All key game variables are exposed publically through an efficient `getAll` method call and events logged to the EVM as the game progresses

## Secure

WagETH is designed to avoid known Ethereum smart contract security issues including recursive calls and stack depth attacks. The contract implements the recommended [withdrawal pattern](http://solidity.readthedocs.io/en/develop/common-patterns.html) for user balances which guarantees prizes can always be paid out when a game ends.

## Testing

The repository includes a comprehensive test suite to validate contract functionality. To run the tests you must install [truffle](https://github.com/trufflesuite/truffle) and be running a local [testrpc](https://github.com/ethereumjs/testrpc). To run the tests execute `truffle test` from within the cloned repository's directory.