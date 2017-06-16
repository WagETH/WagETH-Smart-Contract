/** Contracts **/

var Wageth = artifacts.require("./Wageth.sol");

/** Config **/

var firstGameStartTime = 1498323600; // timestamp when the first game is meant to start
var bidGameTimeExtension = 60 * 60; // seconds the game extends by when a bid is made

/** Tests **/

contract('Wageth', function(accounts) {

	var hostAccount = web3.eth.accounts[0];
	var initialBidderAccount = web3.eth.accounts[1];
	var kingBidderAccount = web3.eth.accounts[2];
	var lowBidderAccount = web3.eth.accounts[3];
	var gameEnderAccount = web3.eth.accounts[4];

	it('should not be active until the first game start time passes', function () {
		return Wageth.deployed().then(function(instance) {
			var block = web3.eth.getBlock("latest");
			var timeToStart = Math.max(firstGameStartTime - block.timestamp, 0);
			
			return evmIncreaseTime(timeToStart)
			.then(function () {
				return instance.gameIsActive.call();
			})
			.then(function (active) {
				assert.equal(active, true, "game is not active at timestamp >= " + firstGameStartTime);
			});
		});
	});

	it("should be in a new game state", function() {
		return Wageth.deployed().then(function(instance) {
			return assertNewGameState(instance);
		});
	});

	it("should handle an initial bet", function() {
		return Wageth.deployed().then(function(instance) {
			web3.eth.sendTransaction({
				from: initialBidderAccount,
				to: instance.address,
				value: web3.toWei(2, "ether")
			});

			var block = web3.eth.getBlock('latest');

			return assertGameState(instance, {
				currentPot: web3.toWei(2, "ether"),
				currentKing: initialBidderAccount,
				highestBet: web3.toWei(2, "ether"),
				endOfGame: block.timestamp + bidGameTimeExtension
			});
		});
	});

	it("should handle a follow on bet which is higher than the initial bet", function() {
		return Wageth.deployed().then(function(instance) {
			web3.eth.sendTransaction({
				from: kingBidderAccount,
				to: instance.address,
				value: web3.toWei(3, "ether")
			});

			var block = web3.eth.getBlock('latest');

			return assertGameState(instance, {
				currentPot: web3.toWei(5, "ether"),
				currentKing: kingBidderAccount,
				highestBet: web3.toWei(3, "ether"),
				endOfGame: block.timestamp + bidGameTimeExtension
			});
		});
	});

	it("should handle a follow on bet which is lower than the last bet", function() {
		return Wageth.deployed().then(function(instance) {
			return getGameState(instance)
			.then(function (state) {
				web3.eth.sendTransaction({
					from: lowBidderAccount,
					to: instance.address,
					value: web3.toWei(1, "ether")
				});

				return assertGameState(instance, {
					currentPot: web3.toWei(6, "ether"),
					currentKing: kingBidderAccount,
					highestBet: web3.toWei(3, "ether"),
					endOfGame: state.endOfGame // should not change if the king is not toppled
				});
			});
		});
	});

	it("should handle the host injecting additional funds into the pot", function() {
		return Wageth.deployed().then(function(instance) {
			return instance.injectIntoPot.sendTransaction({
				from: hostAccount,
				value: web3.toWei(5, "ether")
			})
			.then(function () {
				return getGameState(instance)
				.then(function (state) {
					return assertGameState(instance, {
						currentPot: web3.toWei(11, "ether"),
						currentKing: kingBidderAccount,
						highestBet: web3.toWei(3, "ether"),
						endOfGame: state.endOfGame // should not change just because the host has injected value into the pot
					});
				});
			});
		});
	});

	it("should be able to end the game when endOfGame is reached", function() {
		return Wageth.deployed().then(function(instance) {
			return getGameState(instance)
			.then(function (state) {

				// Test if we can end the game when now != endOfGame

				return instance.shouldEndGame.call()
				.then(function (shouldEnd) {
					assert.equal(shouldEnd, false, "game should be ended but endOfGame not reacted");

					// Test if we can end the game when now >= endOfGame

					var block = web3.eth.getBlock("latest");
					var timeToEnd = state.endOfGame - block.timestamp;

					return evmIncreaseTime(timeToEnd + 10) // + 10 to test > condition rathern than just =
					.then(function () {
						return instance.shouldEndGame.call()
						.then(function (shouldEnd) {
							assert.equal(shouldEnd, true, "endOfGame reached but cannot end game");
						});
					});
				});
			});
		});
	});

	it('should end the game and distribute winnings as pendingWithdrawals', function () {
		return Wageth.deployed().then(function(instance) {
			return getGameState(instance)
			.then(function (state) {
				return instance.endGame.sendTransaction({
					from: gameEnderAccount
				})
				.then(function () {
					var currentPot = state.currentPot;

					var expectedHostFee = currentPot.dividedBy(state.hostFeeDivisor).floor();
					var expectedRollover = currentPot.dividedBy(state.rolloverDivisor).floor();
					var expectedKingPrize = currentPot.minus(expectedHostFee).minus(expectedRollover);

					return Promise.all([
						instance.pendingWithdrawalForAddress.call(hostAccount),
						instance.pendingWithdrawalForAddress.call(state.currentKing)
					])
					.then(function (pendingWithdrawals) {
						assert.isTrue(expectedHostFee.equals(pendingWithdrawals[0]), "host pending withdrawal is not " + expectedHostFee);
						assert.isTrue(expectedKingPrize.equals(pendingWithdrawals[1]), "king pending withdrawal is not " + expectedKingPrize);
					});
				});

			});
		});
	});

	it("should pay last king amount pending withdrawal", function () {
		return Wageth.deployed().then(function(instance) {
			return instance.pendingWithdrawalForAddress.call(kingBidderAccount)
			.then(function (pendingWithdrawal) {
				var initialKingBalance = web3.eth.getBalance(kingBidderAccount);

				return instance.forceWithdraw.sendTransaction(kingBidderAccount, {
					from: hostAccount
				})
				.then(function () {
					var expectedKingBalance = initialKingBalance.add(pendingWithdrawal);

					assert.isTrue(web3.eth.getBalance(kingBidderAccount).equals(expectedKingBalance), "king's balance did not increase by " + pendingWithdrawal);
				});
			});
		});
	});

	it("should be in a new game state and ready to play", function() {
		return Wageth.deployed().then(function(instance) {
			return assertNewGameState(instance)
			.then(function () {
				return instance.gameIsActive.call();
			}).then(function (active) {
				assert.equal(active, true, "game is not active");
			});
		});
	});

});

function getGameState (instance) {
	return instance.getAll.call()
	.then(function (data) {
		return {
			currentKing: data[0].valueOf(),
			currentPot: data[1], // BigNumber
			highestBet: data[2], // BigNumber
			endOfGame: data[3], // BigNumber
			gameId: data[4], // BigNumber
			hostFeeDivisor: data[5], // BigNumber
			rolloverDivisor: data[6] // BigNumber
		}
	});
}

function assertNewGameState (instance) {
	return getGameState(instance)
	.then(function (data) {
		var block = web3.eth.getBlock("latest");

		assert.equal(data.currentKing, '0x0000000000000000000000000000000000000000', "game has a king");
		assert.isTrue(data.highestBet.equals(0), "highest bid is not 0");
		assert.isTrue(data.endOfGame.greaterThan(block.timestamp), "end of game is not a future time");
	});
}

function assertGameState (instance, state) {
	return getGameState(instance)
	.then(function (data) {
		Object.keys(state).forEach(function (key) {
			if (data[key].equals) { // => probably a BigNumber instance
				assert.isTrue(data[key].equals(state[key]), key + " != " + state[key].valueOf());
			} else {
				assert.equal(data[key], state[key], key + " != " + state[key]);
			}
		});
	});
}

function evmIncreaseTime (seconds) {
	return new Promise(function (resolve, reject) {
		return web3.currentProvider.sendAsync({
			jsonrpc: "2.0",
			method: "evm_increaseTime",
			params: [seconds],
			id: new Date().getTime()
		}, function (error, result) {
			return error ? reject(error) : resolve(result.result);
		});
	})
	.then(function () {
		return evmMineBlock();
	});
}

function evmMineBlock (seconds) {
	return new Promise(function (resolve, reject) {
		return web3.currentProvider.sendAsync({
			jsonrpc: "2.0",
			method: "evm_mine",
			params: [],
			id: new Date().getTime()
		}, function (error, result) {
			return error ? reject(error) : resolve(result.result);
		});
	});
}