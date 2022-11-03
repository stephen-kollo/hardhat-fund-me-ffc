const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async () => {
        let fundMe
        let deployer
        let mockV3Aggregator

        // returns "1000000000000000000" on "1" ETH
        const sendValue = ethers.utils.parseEther("1")

        beforeEach(async () => {
            // get all accounts from the local network:
            // const accounts = await ethers.getSigners()
            // const accountZero = accounts[0]
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            fundMe = await ethers.getContract("FundMe", deployer)
            mockV3Aggregator = await ethers.getContract(
                "MockV3Aggregator",
                deployer
            )
        })

        describe("constructor", async () => {
            it("sets the aggregator addresses correctly", async () => {
                const response = await fundMe.s_priceFeed()
                assert.equal(response, mockV3Aggregator.address)
            })
        })

        describe("fund", async () => {
            it("fails if you don't send enough ETH", async () => {
                await expect(fundMe.fund()).to.be.revertedWith(
                    "You need to spend more ETH!"
                )
            })

            it("updated the amount funded data structure", async () => {
                await fundMe.fund({ value: sendValue })
                const response = await fundMe.s_addressToAmountFunded(
                    deployer
                )
                assert.equal(response.toString(), sendValue)
            })

            it("adds s_funders to the array of s_funders", async () => {
                await fundMe.fund({ value: sendValue })
                const funder = await fundMe.s_funders(0)
                assert.equal(funder, deployer)
            })
        })

        describe("withdraw", async () => {
            beforeEach(async () => {
                await fundMe.fund({ value: sendValue })
            })

            it("withdraw ETH from a single founder", async () => {
                // Arrange
                const startingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const startingDeployerBalance = await fundMe.provider.getBalance(
                    deployer
                )

                // Act
                const transactionResponse = await fundMe.withdraw()
                const transactionReceipt = await transactionResponse.wait(1)
                // gasCost must be added to endingDeployerBalance
                // as gas was spent to make transaction
                const { gasUsed, effectiveGasPrice } = transactionReceipt
                const gasCost = gasUsed.mul(effectiveGasPrice)

                const endingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const endingDeployerBalance = await fundMe.provider.getBalance(
                    deployer
                )

                // Assert
                assert.equal(endingFundMeBalance, 0)
                assert.equal(
                    startingFundMeBalance.add(startingDeployerBalance),
                    endingDeployerBalance.add(gasCost).toString()
                )
            })

            it("allow us to withdraw with multiple founder", async () => {
                const accounts = await ethers.getSigners()
                for (let i = 1; i < 6; i++) {
                    const fundMeConnectedContract = await fundMe.connect(accounts[i])
                    await fundMeConnectedContract.fund({ value: sendValue })
                }

                const startingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const startingDeployerBalance = await fundMe.provider.getBalance(
                    deployer
                )

                const transactionResponse = await fundMe.withdraw()
                const transactionReceipt = await transactionResponse.wait(1)
                const { gasUsed, effectiveGasPrice } = transactionReceipt
                const gasCost = gasUsed.mul(effectiveGasPrice)

                const endingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const endingDeployerBalance = await fundMe.provider.getBalance(
                    deployer
                )

                assert.equal(endingFundMeBalance, 0)
                assert.equal(
                    startingFundMeBalance.add(startingDeployerBalance),
                    endingDeployerBalance.add(gasCost).toString()
                )
                await expect(fundMe.s_funders(0)).to.be.reverted
                for (let i = 1; i < 6; i++) {
                    assert.equal(
                        await fundMe.s_addressToAmountFunded(accounts[i].address),
                        0
                    )
                }
            })

            it("only allows the i_owner to withdraw", async () => {
                const accounts = await ethers.getSigners()
                const attacker = accounts[1]
                const attackerConnectedContract = await fundMe.connect(attacker)
                await expect(attackerConnectedContract.withdraw()).to.be.reverted
            })

            it("cheaperWithdraw testing...", async () => {
                // Arrange
                const startingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const startingDeployerBalance = await fundMe.provider.getBalance(
                    deployer
                )

                // Act
                const transactionResponse = await fundMe.cheaperWithdraw()
                const transactionReceipt = await transactionResponse.wait(1)
                // gasCost must be added to endingDeployerBalance
                // as gas was spent to make transaction
                const { gasUsed, effectiveGasPrice } = transactionReceipt
                const gasCost = gasUsed.mul(effectiveGasPrice)

                const endingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const endingDeployerBalance = await fundMe.provider.getBalance(
                    deployer
                )

                // Assert
                assert.equal(endingFundMeBalance, 0)
                assert.equal(
                    startingFundMeBalance.add(startingDeployerBalance),
                    endingDeployerBalance.add(gasCost).toString()
                )
            })
        })
    })