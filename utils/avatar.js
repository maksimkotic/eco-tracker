const path = require('path');

const DEFAULT_AVATAR = 'default-avatar.png';

function getInitial(user) {
  const username = String(user && user.username ? user.username : '').trim();
  return (username.charAt(0) || 'Э').toUpperCase();
}

function isDataImageAvatar(avatar) {
  return /^data:image\/(?:png|jpe?g|gif);base64,/i.test(String(avatar || ''));
}

function hasCustomAvatar(user) {
  return Boolean(user && user.avatar && user.avatar !== DEFAULT_AVATAR);
}

function getAvatarSrc(user) {
  if (!hasCustomAvatar(user)) {
    return null;
  }

  if (isDataImageAvatar(user.avatar)) {
    return user.avatar;
  }

  const filename = path.basename(String(user.avatar));
  const params = new URLSearchParams({ initial: getInitial(user) });
  return `/uploads/avatars/${encodeURIComponent(filename)}?${params.toString()}`;
}

module.exports = {
  DEFAULT_AVATAR,
  getAvatarSrc,
  getInitial,
  hasCustomAvatar,
  isDataImageAvatar
};
