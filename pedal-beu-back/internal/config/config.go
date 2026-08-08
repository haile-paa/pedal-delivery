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
	Twilio   TwilioConfig   `mapstructure:"twilio"` // PHONE VERIFICATION (commented out of use — kept for reference/revert, see main.go)
	SMTP     SMTPConfig     `mapstructure:"smtp"`    // kept for reference/revert — Render's free tier blocks outbound SMTP ports, see pkg/email/client.go
	Brevo    BrevoConfig    `mapstructure:"brevo"`   // used for email verification (Brevo's HTTPS API — works even where raw SMTP is blocked)
	Shipday  ShipdayConfig  `mapstructure:"shipday"`
}

type TwilioConfig struct {
	AccountSID  string `mapstructure:"account_sid"`
	AuthToken   string `mapstructure:"auth_token"`
	PhoneNumber string `mapstructure:"phone_number"`
}

// SMTPConfig holds raw-SMTP credentials. Kept for reference/revert — not
// used by pkg/email/client.go anymore since many hosts (e.g. Render's free
// tier) block outbound SMTP ports 25/465/587.
type SMTPConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
}

// BrevoConfig holds credentials for Brevo's transactional email HTTP API,
// used to send verification OTPs (replaces TwilioConfig/SMS, and replaces
// SMTPConfig as the active email-sending path — see pkg/email/client.go).
type BrevoConfig struct {
	APIKey    string `mapstructure:"api_key"`
	FromEmail string `mapstructure:"from_email"`
	FromName  string `mapstructure:"from_name"`
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
		// PHONE VERIFICATION (commented out of use — kept for reference/revert)
		_ = viper.BindEnv("twilio.account_sid", "TWILIO_ACCOUNT_SID")
		_ = viper.BindEnv("twilio.auth_token", "TWILIO_AUTH_TOKEN")
		_ = viper.BindEnv("twilio.phone_number", "TWILIO_PHONE_NUMBER")
		// Email verification: raw SMTP settings kept for reference/revert
		// (blocked on Render's free tier — see pkg/email/client.go)
		_ = viper.BindEnv("smtp.host", "SMTP_HOST")
		_ = viper.BindEnv("smtp.port", "SMTP_PORT")
		_ = viper.BindEnv("smtp.username", "SMTP_USERNAME")
		_ = viper.BindEnv("smtp.password", "SMTP_PASSWORD")
		_ = viper.BindEnv("smtp.from", "SMTP_FROM")
		// Email verification (active) — Brevo HTTP API settings
		_ = viper.BindEnv("brevo.api_key", "BREVO_API_KEY")
		_ = viper.BindEnv("brevo.from_email", "BREVO_FROM_EMAIL")
		_ = viper.BindEnv("brevo.from_name", "BREVO_FROM_NAME")
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
		viper.SetDefault("smtp.port", "587")

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