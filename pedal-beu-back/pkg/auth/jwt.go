package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/config"
	"github.com/haile-paa/pedal-delivery/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Claims struct {
	UserID  primitive.ObjectID `json:"user_id"`
	Phone   string             `json:"phone"`
	Role    string             `json:"role"`
	TokenID string             `json:"token_id"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

func GenerateToken(user *models.User) (*TokenPair, error) {
	cfg := config.Get()

	now := time.Now()
	accessExpiresAt := now.Add(cfg.JWT.ExpireHours)
	refreshExpiresAt := now.Add(cfg.JWT.RefreshExpHours)

	tokenID := uuid.New().String()

	// Access Token
	accessClaims := &Claims{
		UserID:  user.ID,
		Phone:   user.Phone,
		Role:    user.Role.Type,
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "food-delivery-api",
			Subject:   user.ID.Hex(),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(cfg.JWT.Secret))
	if err != nil {
		return nil, err
	}

	// Refresh Token
	refreshClaims := &Claims{
		UserID:  user.ID,
		Phone:   user.Phone,
		Role:    user.Role.Type,
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "food-delivery-api",
			Subject:   user.ID.Hex(),
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(cfg.JWT.Secret))
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresAt:    accessExpiresAt.Unix(),
	}, nil
}

func ValidateToken(tokenString string) (*Claims, error) {
	cfg := config.Get()

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.JWT.Secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func RefreshToken(refreshToken string) (*TokenPair, error) {
	claims, err := ValidateToken(refreshToken)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		ID:    claims.UserID,
		Phone: claims.Phone,
		Role: models.UserRole{
			Type: claims.Role,
		},
	}

	return GenerateToken(user)
}
