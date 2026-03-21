package config

import (
	"log"
	"sync"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	AWS      AWSConfig      `mapstructure:"aws"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Twilio   TwilioConfig   `mapstructure:"twilio"`
	Shipday  ShipdayConfig  `mapstructure:"shipday"`
}

type TwilioConfig struct {
	AccountSID  string `mapstructure:"account_sid"`
	AuthToken   string `mapstructure:"auth_token"`
	PhoneNumber string `mapstructure:"phone_number"`
}

type ShipdayConfig struct {
	APIKey  string `mapstructure:"api_key"`
	BaseURL string `mapstructure:"base_url"`
}

type ServerConfig struct {
	Port         string        `mapstructure:"port"`
	Environment  string        `mapstructure:"environment"`
	EnableCORS   bool          `mapstructure:"enable_cors"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
}

type DatabaseConfig struct {
	URI      string `mapstructure:"uri"`
	Database string `mapstructure:"database"`
}

type RedisConfig struct {
	URL      string `mapstructure:"url"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type AWSConfig struct {
	Region          string `mapstructure:"region"`
	AccessKeyID     string `mapstructure:"access_key_id"`
	SecretAccessKey string `mapstructure:"secret_access_key"`
	S3Bucket        string `mapstructure:"s3_bucket"`
}

type JWTConfig struct {
	Secret          string        `mapstructure:"secret"`
	ExpireHours     time.Duration `mapstructure:"expire_hours"`
	RefreshExpHours time.Duration `mapstructure:"refresh_exp_hours"`
}

var (
	once     sync.Once
	instance *Config
)

func Load() *Config {
	once.Do(func() {
		viper.SetConfigName(".env")
		viper.SetConfigType("env")
		viper.AddConfigPath(".")
		viper.AddConfigPath("./config")
		viper.AddConfigPath("/etc/delivery")
		viper.AddConfigPath("/etc/secrets") // for Render secret file

		viper.AutomaticEnv()

		// Explicitly bind environment variables to config keys
		_ = viper.BindEnv("database.uri", "DATABASE_URI")
		_ = viper.BindEnv("database.database", "DATABASE_DATABASE")
		_ = viper.BindEnv("server.port", "SERVER_PORT")
		_ = viper.BindEnv("server.environment", "SERVER_ENVIRONMENT")
		_ = viper.BindEnv("redis.url", "REDIS_URL")
		_ = viper.BindEnv("redis.password", "REDIS_PASSWORD")
		_ = viper.BindEnv("redis.db", "REDIS_DB")
		_ = viper.BindEnv("twilio.account_sid", "TWILIO_ACCOUNT_SID")
		_ = viper.BindEnv("twilio.auth_token", "TWILIO_AUTH_TOKEN")
		_ = viper.BindEnv("twilio.phone_number", "TWILIO_PHONE_NUMBER")
		_ = viper.BindEnv("cloudinary.cloud_name", "CLOUDINARY_CLOUD_NAME")
		_ = viper.BindEnv("cloudinary.api_key", "CLOUDINARY_API_KEY")
		_ = viper.BindEnv("cloudinary.api_secret", "CLOUDINARY_API_SECRET")
		_ = viper.BindEnv("shipday.api_key", "SHIPDAY_API_KEY")
		_ = viper.BindEnv("shipday.base_url", "SHIPDAY_BASE_URL")

		// Set defaults
		viper.SetDefault("server.port", "8080")
		viper.SetDefault("server.environment", "development")
		viper.SetDefault("server.enable_cors", true)
		viper.SetDefault("server.read_timeout", 10*time.Second)
		viper.SetDefault("server.write_timeout", 10*time.Second)
		viper.SetDefault("jwt.expire_hours", 24*time.Hour)
		viper.SetDefault("jwt.refresh_exp_hours", 168*time.Hour)
		viper.SetDefault("shipday.base_url", "https://api.shipday.com")

		if err := viper.ReadInConfig(); err != nil {
			log.Printf("Error reading config file: %v", err)
		}

		instance = &Config{}
		if err := viper.Unmarshal(instance); err != nil {
			log.Fatalf("Unable to decode config: %v", err)
		}
	})

	return instance
}

func Get() *Config {
	if instance == nil {
		return Load()
	}
	return instance
}