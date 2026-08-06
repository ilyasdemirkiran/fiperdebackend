package com.ilyasdemirkiran.config

import com.ilyasdemirkiran.types.Money
import org.bson.BsonReader
import org.bson.BsonType
import org.bson.BsonWriter
import org.bson.codecs.Codec
import org.bson.codecs.DecoderContext
import org.bson.codecs.EncoderContext
import org.bson.codecs.configuration.CodecProvider
import org.bson.codecs.configuration.CodecRegistry

/**
 * BSON Codec for the Money inline value class.
 * Reads/writes Money as a Long (amountInCents) in BSON.
 * Handles legacy Double and Int values gracefully.
 */
class MoneyCodec : Codec<Money> {
    override fun getEncoderClass(): Class<Money> = Money::class.java

    override fun encode(writer: BsonWriter, value: Money, encoderContext: EncoderContext) {
        writer.writeInt64(value.amountInCents)
    }

    override fun decode(reader: BsonReader, decoderContext: DecoderContext): Money {
        return when (reader.currentBsonType) {
            BsonType.INT64 -> Money(reader.readInt64())
            BsonType.INT32 -> Money(reader.readInt32().toLong())
            BsonType.DOUBLE -> Money.fromDouble(reader.readDouble())
            BsonType.NULL -> { reader.readNull(); Money.ZERO }
            else -> { reader.skipValue(); Money.ZERO }
        }
    }
}

/**
 * CodecProvider that supplies MoneyCodec to the registry.
 */
class MoneyCodecProvider : CodecProvider {
    @Suppress("UNCHECKED_CAST")
    override fun <T> get(clazz: Class<T>, registry: CodecRegistry): Codec<T>? {
        if (clazz == Money::class.java) {
            return MoneyCodec() as Codec<T>
        }
        return null
    }
}
