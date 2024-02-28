const BCRYPT_SALT_ROUNDS = 8;
import bcrypt from 'bcrypt';

export const hashPassword = (password) => {
    if (!password) {
        return null;
    }
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

export const checkPassword = (hash, password) => {
    return bcrypt.compare(password, hash);
}