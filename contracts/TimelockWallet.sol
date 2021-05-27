// SPDX-License-Identifier: MIT;

pragma solidity 0.8.0;

import "./ownable/Ownable.sol";
import "./interfaces/IERC20.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/math/SafeMath.sol";

contract TimelockWallet is Ownable {
  /// @notice SafeERC20 library using for IERC20.
  using SafeERC20 for IERC20;

  /// @notice SafeMath library using for math.
  using SafeMath for uint256;

  /// @notice startTime of a TimeLock Wallet;
  uint256 public startTime;

  /// @notice unlockTime last date to release.
  uint256 public unlockTime;

  /// @notice tokens mapping to store nTokens Locked.
  mapping(address => uint256) public tokens;

  /// @notice event TokenLocked emit on every token locking.
  event TokenLocked(address tokenAddress, uint256 time);

  /// @notice event Withdraw emit on every withdraw.
  event Withdraw(address tokenAddress, uint256 time);

  /**
   * @notice construst a TimelockWallet contract.
   * @notice deployment will failed when lockingPeriod > 0.
   * @param lockingPeriod locking period eg 90 days, 180 days in seconds.
   */
  constructor(uint256 lockingPeriod) {
    require(
      lockingPeriod > 0,
      "TimelockWallet: durantion should be gt than zero"
    );
    startTime = getNow();
    unlockTime = startTime.add(lockingPeriod);
  }

  /**
   * @notice lock token function to handle token locking.
   * @notice revert on if token address is zero.
   * @notice revert on if noOfToken is not gt zero.
   * @param token ERC20 token.
   * @param noOfTokens number of Tokens to locked.
   */

  function lockToken(IERC20 token, uint256 noOfTokens) external onlyOwner {
    require(address(token) != address(0), "TimelockWallet: invalid address");
    require(noOfTokens > 0, "TimelockWallet: invalid amount");

    tokens[address(token)] = tokens[address(token)].add(noOfTokens);
    token.safeTransferFrom(_msgSender(), address(this), noOfTokens);
    emit TokenLocked(address(token), getNow());
  }

  /**
   * @notice safeWithdraw for handling admin withdrawals.
   * @notice revert on if token address is zero.
   * @notice revert on if there is no withdrawble token.
   * @param token ERC20 token.
   */

  function safeWithdraw(IERC20 token) external onlyOwner {
    require(address(token) != address(0), "TimelockWallet: invalid address");
    require(
      tokens[address(token)] > 0,
      "TimelockWallet: tokens not withdrawble"
    );
    require(getNow() > unlockTime, "TimelockWallet: tokens locked");

    uint256 nTokens = tokens[address(token)];
    tokens[address(token)] = 0;

    token.safeTransfer(_msgSender(), nTokens);
    emit Withdraw(address(token), getNow());
  }

  /**
   * @notice updateUnlockTime for updating unlockTime.
   * @notice failed on when lockingPeriod is less than zero.
   * @param lockingPeriod define locking days in seconds.
   * @return bool true
   */

  function updateUnlockTime(uint256 lockingPeriod)
    external
    onlyOwner
    returns (bool)
  {
    require(
      lockingPeriod > 0,
      "TimelockWallet: durantion should be greater than zero"
    );
    unlockTime = startTime.add(lockingPeriod);
    return true;
  }

  /**
   * @notice getNow function for getting block timestamp.
   * @return uint256 -> block.timestamp
   */

  function getNow() internal view returns (uint256) {
    return block.timestamp;
  }
}
