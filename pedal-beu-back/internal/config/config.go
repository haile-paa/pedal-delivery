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
	SMS      SMSConfig      `mapstructure:"sms"`
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

type SMSConfig struct {
	AccountSID string `mapstructure:"account_sid"`
	AuthToken  string `mapstructure:"auth_token"`
	Phone      string `mapstructure:"phone"`
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
		viper.AddConfigPath("/etc/delivery/")

		viper.AutomaticEnv()

		// Set defaults
		viper.SetDefault("server.port", "8080")
		viper.SetDefault("server.environment", "development")
		viper.SetDefault("server.enable_cors", true)
		viper.SetDefault("server.read_timeout", 10*time.Second)
		viper.SetDefault("server.write_timeout", 10*time.Second)
		viper.SetDefault("jwt.expire_hours", 24*time.Hour)
		viper.SetDefault("jwt.refresh_exp_hours", 168*time.Hour)

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
